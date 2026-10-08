import { Injectable } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql } from "kysely";
import { AppConfig } from "../../../platform/config/app-config.js";
import { DatabaseService } from "../../../platform/database/database.service.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";

@Injectable()
export class StaffInvitationsService {
  private readonly auth: SupabaseClient | undefined;
  private readonly redirectTo: string;

  public constructor(
    private readonly database: DatabaseService,
    config: AppConfig,
  ) {
    this.redirectTo = new URL("/auth/login?next=%2Fadmin%2Freviews", config.corsAllowOrigins[0]).href;
    if (config.supabaseUrl && config.supabaseSecretKey) {
      this.auth = createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
  }

  public async list(): Promise<Array<{
    invitationId: string;
    email: string;
    status: string;
    createdAt: Date;
  }>> {
    const rows = await this.database.db.selectFrom("identity.staff_invitations")
      .select(["invitation_id", "email", "status", "created_at"])
      .orderBy("created_at", "desc")
      .limit(100).execute();
    return rows.map((row) => ({
      invitationId: row.invitation_id,
      email: row.email,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  public async invite(email: string, actorAccountId: string, correlationId: string): Promise<{
    invitationId: string;
    email: string;
    status: "pending";
  }> {
    if (!this.auth) {
      throw new ProblemException(503, "system.dependencyUnavailable", "Staff invitations are not configured.");
    }
    const normalized = email.trim().toLowerCase();
    const existing = await this.database.db.selectFrom("identity.staff_invitations")
      .select("invitation_id").where("email", "=", normalized).executeTakeFirst();
    if (existing) {
      throw new ProblemException(409, "identity.invitationConflict", "This email has already been invited.");
    }

    // Supabase refuses a confirmed existing user. No email ever confers a role.
    const { data, error } = await this.auth.auth.admin.inviteUserByEmail(normalized, {
      redirectTo: this.redirectTo,
    });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists"
        || error.status === 422 || error.status === 409) {
        throw new ProblemException(409, "identity.invitationConflict", "The account has already been registered or invited.");
      }
      throw new ProblemException(503, "system.dependencyUnavailable", "The invitation could not be delivered.");
    }
    const subjectId = data.user.id;
    return this.database.transaction(async (tx) => {
      await tx.insertInto("identity.accounts")
        .values({ account_id: subjectId, email: null })
        .onConflict((conflict) => conflict.column("account_id").doNothing())
        .execute();
      const record = await tx.insertInto("identity.staff_invitations")
        .values({ account_id: subjectId, email: normalized, invited_by_account_id: actorAccountId, correlation_id: correlationId })
        .returning(["invitation_id", "email", "status"]).executeTakeFirstOrThrow();
      await tx.insertInto("identity.authorization_audit_events").values({
        actor_account_id: actorAccountId,
        subject_account_id: subjectId,
        event_type: "identity.staff-invited",
        outcome: "changed",
        reason: "Invited to verify source evidence and review panda records",
        correlation_id: correlationId,
        details: { invitationId: record.invitation_id, role: "reviewer" },
      }).execute();
      return { invitationId: record.invitation_id, email: record.email, status: "pending" as const };
    });
  }

  public async accept(accountId: string, correlationId: string): Promise<{ status: "accepted"; accountId: string }> {
    return this.database.transaction(async (tx) => {
      const invitation = await tx.selectFrom("identity.staff_invitations")
        .selectAll().where("account_id", "=", accountId).forUpdate().executeTakeFirst();
      if (!invitation) {
        throw new ProblemException(404, "identity.invitationMissing", "No staff invitation exists for this account.");
      }
      if (invitation.status === "accepted") return { accountId, status: "accepted" };

      const verified = await sql<{ email: string }>`
        select email from auth.users
        where id = ${accountId}::uuid and email_confirmed_at is not null
      `.execute(tx);
      if (verified.rows[0]?.email?.toLowerCase() !== invitation.email) {
        throw new ProblemException(403, "identity.invitationNotVerified", "Verify the invited email address first.");
      }
      const account = await tx.selectFrom("identity.accounts")
        .select("state").where("account_id", "=", accountId).forUpdate().executeTakeFirst();
      if (account?.state !== "active") {
        throw new ProblemException(403, "authorization.accountInactive", "This account is not active.");
      }
      const staffAssignments = await sql<{ role_key: string }>`
        select grant_role.role_key from identity.role_assignments grant_role
        left join identity.role_assignment_revocations revoked
          on revoked.assignment_id = grant_role.assignment_id
        where grant_role.account_id = ${accountId}::uuid
          and grant_role.role_key <> 'member'
          and revoked.assignment_id is null
          and (grant_role.expires_at is null or grant_role.expires_at > now())
      `.execute(tx);
      if (staffAssignments.rows.length) {
        throw new ProblemException(409, "identity.invitationConflict", "This account already has staff roles.");
      }

      for (const roleKey of ["member", "reviewer"]) {
        const existing = await sql<{ assignment_id: string }>`
          select grant_role.assignment_id from identity.role_assignments grant_role
          left join identity.role_assignment_revocations revoked
            on revoked.assignment_id = grant_role.assignment_id
          where grant_role.account_id = ${accountId}::uuid
            and grant_role.role_key = ${roleKey}
            and revoked.assignment_id is null
            and (grant_role.expires_at is null or grant_role.expires_at > now())
        `.execute(tx);
        if (existing.rows.length) continue;

        const grant = await tx.insertInto("identity.role_assignments").values({
          account_id: accountId,
          role_key: roleKey,
          assigned_by_account_id: invitation.invited_by_account_id,
          reason: "Accepted verified reviewer invitation",
          source: "staff_invitation",
          correlation_id: correlationId,
          idempotency_key: `staff-invitation:${invitation.invitation_id}:${roleKey}`,
        }).returning("assignment_id").executeTakeFirstOrThrow();
        await tx.insertInto("identity.authorization_audit_events").values({
          actor_account_id: invitation.invited_by_account_id,
          subject_account_id: accountId,
          assignment_id: grant.assignment_id,
          role_key: roleKey,
          event_type: "identity.role-assigned",
          outcome: "assigned",
          reason: "Verified reviewer invitation accepted",
          correlation_id: correlationId,
          details: { invitationId: invitation.invitation_id, role: roleKey },
        }).execute();
        await tx.insertInto("integration.outbox_events").values({
          event_type: "identity.role-assigned",
          source_context: "identity",
          aggregate_type: "identity.account",
          aggregate_id: accountId,
          correlation_id: correlationId,
          idempotency_key: `staff-invitation:${invitation.invitation_id}:${roleKey}`,
          occurred_at: new Date(),
          payload: { accountId, roleKey, assignmentId: grant.assignment_id },
        }).execute();
      }
      await tx.updateTable("identity.staff_invitations")
        .set({ status: "accepted", accepted_at: new Date() })
        .where("invitation_id", "=", invitation.invitation_id).execute();
      await tx.updateTable("identity.accounts")
        .set({ email: invitation.email }).where("account_id", "=", accountId).execute();
      return { accountId, status: "accepted" };
    });
  }
}
