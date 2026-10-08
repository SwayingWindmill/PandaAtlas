import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { DatabaseService } from "../../../platform/database/database.service.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";

type Action = "suspend" | "reinstate";

@Injectable()
export class StaffAccountLifecycleService {
  public constructor(private readonly database: DatabaseService) {}

  public async change(accountId: string, actorId: string, action: Action, reason: string, idempotencyKey: string, correlationId: string) {
    if (accountId === actorId) {
      throw new ProblemException(403, "identity.selfSuspensionForbidden", "Staff cannot suspend or reinstate themselves.");
    }
    if (!reason.trim()) throw new ProblemException(400, "identity.reasonRequired", "Account state changes require a reason.");
    const target = action === "suspend" ? "suspended" : "active";
    const source = action === "suspend" ? "active" : "suspended";
    return this.database.transaction(async (tx) => {
      const account = await tx.selectFrom("identity.accounts")
        .select(["state", "state_reason"]).where("account_id", "=", accountId).forUpdate().executeTakeFirst();
      if (!account) throw new ProblemException(404, "identity.accountMissing", "Staff account not found.");

      const replay = await tx.selectFrom("identity.account_state_events")
        .selectAll().where("idempotency_key", "=", idempotencyKey).executeTakeFirst();
      if (replay) {
        if (replay.account_id !== accountId || replay.actor_account_id !== actorId || replay.next_state !== target ||
          replay.reason !== reason.trim() || account.state !== target) {
          throw new ProblemException(409, "identity.idempotencyConflict", "The request key was used for a different or superseded transition.");
        }
        return { accountId, state: target };
      }

      const staff = await sql<{ exists: boolean }>`select (
        exists (select 1 from identity.staff_invitations where account_id=${accountId}::uuid)
        or exists (select 1 from identity.role_assignments ra
          join identity.roles r on r.role_key=ra.role_key and r.is_staff
          where ra.account_id=${accountId}::uuid)
      ) as exists`.execute(tx);
      if (!staff.rows[0]?.exists) {
        throw new ProblemException(403, "identity.notStaff", "Only staff identities can be managed here.");
      }
      if (account.state !== source) {
        throw new ProblemException(409, "identity.accountStateConflict", "The account is not in the expected state.");
      }
      if (action === "reinstate" && !account.state_reason?.startsWith("staff:")) {
        throw new ProblemException(409, "identity.suspensionOwnedElsewhere", "This suspension belongs to another authority.");
      }
      if (action === "suspend") {
        // Serialize administrator suspensions so two concurrent operators cannot disable the last admin.
        await sql`select pg_advisory_xact_lock(hashtext('identity.last-active-administrator'))`.execute(tx);
        const hasAdmin = await sql<{ present: boolean }>`
          select exists (
            select 1 from identity.role_assignments ra
            left join identity.role_assignment_revocations rv on rv.assignment_id=ra.assignment_id
            where ra.account_id=${accountId}::uuid and ra.role_key='administrator'
              and rv.assignment_id is null and (ra.expires_at is null or ra.expires_at>now())
          ) as present
        `.execute(tx);
        if (hasAdmin.rows[0]?.present) {
          const admins = await sql<{ count: string }>`
            select count(distinct a.account_id)::text as count from identity.accounts a
            join identity.role_assignments ra on ra.account_id=a.account_id and ra.role_key='administrator'
            left join identity.role_assignment_revocations rv on rv.assignment_id=ra.assignment_id
            where a.state='active' and rv.assignment_id is null
              and (ra.expires_at is null or ra.expires_at>now())
          `.execute(tx);
          if (Number(admins.rows[0]?.count) <= 1) {
            throw new ProblemException(409, "identity.lastAdministrator", "The last active administrator cannot be suspended.");
          }
        }
      }

      const now = new Date();
      await tx.updateTable("identity.accounts")
        .set({ state: target, state_reason: action === "suspend" ? `staff:${reason.trim()}` : null,
          state_changed_at: now })
        .where("account_id", "=", accountId).executeTakeFirstOrThrow();
      await tx.insertInto("identity.account_state_events").values({
        account_id: accountId, previous_state: source, next_state: target,
        actor_account_id: actorId, reason: reason.trim(), correlation_id: correlationId,
        idempotency_key: idempotencyKey,
      }).execute();
      const eventType = action === "suspend" ? "identity.account-suspended" : "identity.account-reinstated";
      await tx.insertInto("identity.authorization_audit_events").values({
        event_type: eventType, actor_account_id: actorId, subject_account_id: accountId,
        outcome: "changed", reason: reason.trim(), correlation_id: correlationId,
        details: { previousState: source, nextState: target, authority: "staff" },
      }).execute();
      await tx.insertInto("integration.outbox_events").values({
        event_type: eventType, source_context: "identity", aggregate_type: "identity.account",
        aggregate_id: accountId, correlation_id: correlationId,
        idempotency_key: `staff-account:${idempotencyKey}`, occurred_at: now,
        payload: { accountId, previousState: source, nextState: target },
      }).execute();
      return { accountId, state: target };
    });
  }
}
