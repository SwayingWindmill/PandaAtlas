import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { DatabaseService, type DatabaseTransaction } from "../../../platform/database/database.service.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";

const NON_DELEGABLE_ROLES = ["administrator", "community_scanner"];

export interface StaffRoleAssignment {
  assignmentId: string;
  roleKey: string;
  roleName: string;
  assignedAt: Date;
  assignedBy: string | null;
  reason: string;
  status: "active" | "revoked" | "expired";
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
}

@Injectable()
export class StaffRolesService {
  public constructor(private readonly database: DatabaseService) {}

  public async directory() {
    const result = await sql<{ accountId: string; email: string | null; state: string; roles: string[] }>`
      select a.account_id as "accountId", a.email, a.state::text,
        coalesce(array_agg(distinct r.role_key) filter (where r.role_key is not null), '{}') as roles
      from identity.accounts a
      left join identity.role_assignments ra on ra.account_id = a.account_id
        and (ra.expires_at is null or ra.expires_at > now())
      left join identity.role_assignment_revocations rv on rv.assignment_id = ra.assignment_id
      left join identity.roles r on r.role_key = ra.role_key and r.is_staff and rv.assignment_id is null
      where exists (select 1 from identity.staff_invitations i where i.account_id = a.account_id)
         or exists (select 1 from identity.role_assignments grant_role
           join identity.roles role on role.role_key = grant_role.role_key and role.is_staff
           where grant_role.account_id = a.account_id)
      group by a.account_id
      order by a.created_at desc
      limit 100
    `.execute(this.database.db);
    return result.rows;
  }

  public async roles() {
    return this.database.db.selectFrom("identity.roles")
      .select(["role_key as roleKey", "display_name as displayName", "description"])
      .where("is_staff", "=", true)
      .where("role_key", "not in", NON_DELEGABLE_ROLES)
      .orderBy("role_key").execute();
  }

  public async detail(accountId: string) {
    const account = await this.database.db.selectFrom("identity.accounts")
      .select(["account_id as accountId", "email", "state"])
      .where("account_id", "=", accountId).executeTakeFirst();
    if (!account) throw new ProblemException(404, "identity.accountMissing", "Staff account not found.");

    const history = await sql<StaffRoleAssignment>`
      select ra.assignment_id as "assignmentId", ra.role_key as "roleKey",
        r.display_name as "roleName", ra.assigned_at as "assignedAt",
        ra.assigned_by_account_id as "assignedBy", ra.reason,
        case when rv.assignment_id is not null then 'revoked'
             when ra.expires_at is not null and ra.expires_at <= now() then 'expired'
             else 'active' end as status,
        rv.revoked_at as "revokedAt", rv.revoked_by_account_id as "revokedBy",
        rv.reason as "revocationReason"
      from identity.role_assignments ra
      join identity.roles r on r.role_key = ra.role_key
      left join identity.role_assignment_revocations rv on rv.assignment_id = ra.assignment_id
      where ra.account_id = ${accountId}::uuid
      order by ra.assigned_at desc, ra.assignment_id desc
      limit 100
    `.execute(this.database.db);

    const permissions = await sql<{ capability_key: string }>`
      select distinct rc.capability_key from identity.role_assignments ra
      join identity.role_capabilities rc on rc.role_key = ra.role_key
      left join identity.role_assignment_revocations rv on rv.assignment_id = ra.assignment_id
      where ra.account_id = ${accountId}::uuid and rv.assignment_id is null
        and (ra.expires_at is null or ra.expires_at > now())
      order by rc.capability_key
    `.execute(this.database.db);
    return { ...account, assignments: history.rows,
      capabilities: account.state === "active" ? permissions.rows.map((p) => p.capability_key) : [] };
  }

  public async grant(subjectId: string, roleKey: string, reason: string, idempotencyKey: string, actorId: string, correlationId: string) {
    this.validateChange(subjectId, actorId, reason);
    return this.database.transaction(async (tx) => {
      await this.lockActiveSubject(tx, subjectId);
      await this.validateRole(tx, roleKey);
      const replay = await tx.selectFrom("identity.role_assignments")
        .selectAll().where("account_id", "=", subjectId).where("idempotency_key", "=", idempotencyKey).executeTakeFirst();
      if (replay) {
        if (replay.role_key !== roleKey || replay.reason !== reason.trim() || replay.assigned_by_account_id !== actorId) {
          throw new ProblemException(409, "identity.idempotencyConflict", "This request key was used for a different grant.");
        }
        const revoked = await tx.selectFrom("identity.role_assignment_revocations")
          .select("revocation_id").where("assignment_id", "=", replay.assignment_id).executeTakeFirst();
        if (revoked || (replay.expires_at && replay.expires_at <= new Date())) {
          throw new ProblemException(409, "identity.roleConflict", "A previous grant cannot be resurrected.");
        }
        return { assignmentId: replay.assignment_id, roleKey, status: "active" as const };
      }
      const active = await this.activeRoles(tx, subjectId);
      if (active.some((assignment) => assignment.role_key === roleKey)) {
        throw new ProblemException(409, "identity.roleConflict", "The subject already has this role.");
      }
      await this.assertSeparatedDuties(tx, [...active.map((assignment) => assignment.role_key), roleKey]);
      const grant = await tx.insertInto("identity.role_assignments").values({
        account_id: subjectId, role_key: roleKey, assigned_by_account_id: actorId,
        reason: reason.trim(), source: "staff_role_management", correlation_id: correlationId,
        idempotency_key: idempotencyKey,
      }).returning("assignment_id").executeTakeFirstOrThrow();
      await tx.insertInto("identity.authorization_audit_events").values({
        actor_account_id: actorId, subject_account_id: subjectId, assignment_id: grant.assignment_id,
        role_key: roleKey, event_type: "identity.role-assigned", outcome: "assigned",
        reason: reason.trim(), correlation_id: correlationId,
        details: { source: "staff_role_management" },
      }).execute();
      await tx.insertInto("integration.outbox_events").values({
        event_type: "identity.role-assigned", source_context: "identity",
        aggregate_type: "identity.account", aggregate_id: subjectId,
        correlation_id: correlationId, idempotency_key: `staff-role-grant:${idempotencyKey}`,
        occurred_at: new Date(),
        payload: { accountId: subjectId, roleKey, assignmentId: grant.assignment_id },
      }).execute();
      return { assignmentId: grant.assignment_id, roleKey, status: "active" as const };
    });
  }

  public async revoke(subjectId: string, assignmentId: string, reason: string, idempotencyKey: string, actorId: string, correlationId: string) {
    this.validateChange(subjectId, actorId, reason);
    return this.database.transaction(async (tx) => {
      // Removing authority remains possible when a subject is suspended or no longer email-verified.
      await this.lockSubject(tx, subjectId);
      const assignment = await tx.selectFrom("identity.role_assignments")
        .selectAll().where("account_id", "=", subjectId)
        .where("assignment_id", "=", assignmentId).executeTakeFirst();
      if (!assignment) throw new ProblemException(404, "identity.roleMissing", "Role assignment not found.");
      await this.validateRole(tx, assignment.role_key);
      const keyOwner = await tx.selectFrom("identity.role_assignment_revocations")
        .select("assignment_id").where("idempotency_key", "=", idempotencyKey).executeTakeFirst();
      if (keyOwner && keyOwner.assignment_id !== assignmentId) {
        throw new ProblemException(409, "identity.idempotencyConflict", "This request key belongs to another revocation.");
      }
      const previous = await tx.selectFrom("identity.role_assignment_revocations")
        .selectAll().where("assignment_id", "=", assignmentId).executeTakeFirst();
      if (previous) {
        if (previous.idempotency_key !== idempotencyKey || previous.reason !== reason.trim() || previous.revoked_by_account_id !== actorId) {
          throw new ProblemException(409, "identity.roleConflict", "This assignment is already revoked.");
        }
        return { assignmentId, roleKey: assignment.role_key, status: "revoked" as const };
      }
      if (assignment.expires_at && assignment.expires_at <= new Date()) {
        throw new ProblemException(409, "identity.roleConflict", "The role assignment has expired.");
      }
      await tx.insertInto("identity.role_assignment_revocations").values({
        assignment_id: assignmentId, revoked_by_account_id: actorId, reason: reason.trim(),
        correlation_id: correlationId, idempotency_key: idempotencyKey,
      }).execute();
      await tx.insertInto("identity.authorization_audit_events").values({
        actor_account_id: actorId, subject_account_id: subjectId, assignment_id: assignmentId,
        role_key: assignment.role_key, event_type: "identity.role-revoked", outcome: "revoked",
        reason: reason.trim(), correlation_id: correlationId,
        details: { source: "staff_role_management" },
      }).execute();
      await tx.insertInto("integration.outbox_events").values({
        event_type: "identity.role-revoked", source_context: "identity",
        aggregate_type: "identity.account", aggregate_id: subjectId,
        correlation_id: correlationId, idempotency_key: `staff-role-revoke:${idempotencyKey}`,
        occurred_at: new Date(),
        payload: { accountId: subjectId, roleKey: assignment.role_key, assignmentId },
      }).execute();
      return { assignmentId, roleKey: assignment.role_key, status: "revoked" as const };
    });
  }

  private validateChange(subjectId: string, actorId: string, reason: string) {
    if (subjectId === actorId) throw new ProblemException(403, "identity.selfGrantForbidden", "Staff cannot change their own roles.");
    if (!reason.trim()) throw new ProblemException(400, "identity.reasonRequired", "A role change needs a reason.");
  }

  private async lockActiveSubject(tx: DatabaseTransaction, subjectId: string) {
    const account = await this.lockSubject(tx, subjectId);
    if (account.state !== "active") throw new ProblemException(409, "identity.accountInactive", "Only active accounts can receive roles.");
    const verified = await sql<{ confirmed: boolean }>`
      select (email_confirmed_at is not null) as confirmed from auth.users where id=${subjectId}::uuid
    `.execute(tx);
    if (!verified.rows[0]?.confirmed) {
      throw new ProblemException(409, "identity.emailUnverified", "The staff identity must verify its email before receiving a role.");
    }
  }

  private async lockSubject(tx: DatabaseTransaction, subjectId: string) {
    const account = await tx.selectFrom("identity.accounts")
      .select("state").where("account_id", "=", subjectId).forUpdate().executeTakeFirst();
    if (!account) throw new ProblemException(404, "identity.accountMissing", "Staff account not found.");
    return account;
  }

  private async validateRole(tx: DatabaseTransaction, roleKey: string) {
    const role = await tx.selectFrom("identity.roles")
      .select("is_staff").where("role_key", "=", roleKey).executeTakeFirst();
    if (!role?.is_staff || NON_DELEGABLE_ROLES.includes(roleKey)) {
      throw new ProblemException(403, "identity.roleNotDelegable", "This role is not delegated by staff managers.");
    }
  }

  private async activeRoles(tx: DatabaseTransaction, accountId: string) {
    return tx.selectFrom("identity.role_assignments as ra")
      .leftJoin("identity.role_assignment_revocations as rv", "rv.assignment_id", "ra.assignment_id")
      .select("ra.role_key").where("ra.account_id", "=", accountId)
      .where("rv.assignment_id", "is", null)
      .where((eb) => eb.or([eb("ra.expires_at", "is", null), eb("ra.expires_at", ">", new Date())]))
      .execute();
  }

  private async assertSeparatedDuties(tx: DatabaseTransaction, roles: string[]) {
    const capabilities = await tx.selectFrom("identity.role_capabilities")
      .select("capability_key").where("role_key", "in", roles).execute();
    const keys = new Set(capabilities.map((row) => row.capability_key));
    if (keys.has("review.case.decide") &&
      (keys.has("curation.change.approve") || keys.has("publication.release.activate"))) {
      throw new ProblemException(409, "identity.dutiesConflict", "Review and final approval duties must stay separate.");
    }
  }
}
