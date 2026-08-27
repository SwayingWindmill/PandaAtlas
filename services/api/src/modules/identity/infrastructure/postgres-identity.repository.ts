import { sql } from "kysely";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  AssuranceLevel,
  AuthorizationSnapshot,
  CapabilityPolicy,
} from "../application/identity-access.types.js";
import { AccountProvisioningBlockedError } from "../application/identity.errors.js";
import type { IdentityNotificationContactPort } from "../application/identity-notification.port.js";
import type { IdentityPrivacyPort } from "../application/identity-privacy.port.js";
import type {
  IdentityModerationParticipant,
  ModerationAccountStateInput,
} from "../application/identity-moderation.port.js";
import type { FanProfile, IdentityPort, UpdateFanProfileInput } from "../application/identity.port.js";

interface AuthorizationRow {
  account_id: string;
  account_state: "active" | "suspended" | "deleting" | "deleted";
  capability_key: string | null;
  requires_recent_auth: boolean | null;
  minimum_aal: string | null;
  requires_live_session: boolean | null;
}

function assuranceLevel(value: string | null): AssuranceLevel {
  return value === "aal2" ? "aal2" : "aal1";
}

export class PostgresIdentityRepository
  implements IdentityPort, IdentityModerationParticipant, IdentityNotificationContactPort, IdentityPrivacyPort
{
  public constructor(private readonly database: DatabaseService) {}

  public async loadAuthorizationSnapshot(accountId: string): Promise<AuthorizationSnapshot | undefined> {
    return this.loadSnapshot(this.database.db, accountId);
  }

  public async isLiveSession(sessionId: string, accountId: string): Promise<boolean> {
    const result = await sql<{ live: boolean }>`
      select identity.is_live_auth_session(${sessionId}::uuid, ${accountId}::uuid) as live
    `.execute(this.database.db);
    return result.rows[0]?.live === true;
  }

  public async getProfile(accountId: string): Promise<FanProfile> {
    const row = await this.database.db
      .selectFrom("identity.profiles")
      .select(["account_id", "nickname", "bio"])
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    return row === undefined
      ? { accountId, nickname: "", bio: "" }
      : { accountId: row.account_id, nickname: row.nickname, bio: row.bio };
  }

  public async replaceProfile(accountId: string, input: UpdateFanProfileInput): Promise<FanProfile> {
    const row = await this.database.db
      .insertInto("identity.profiles")
      .values({ account_id: accountId, nickname: input.nickname, bio: input.bio })
      .onConflict((conflict) =>
        conflict.column("account_id").doUpdateSet({
          nickname: input.nickname,
          bio: input.bio,
          updated_at: new Date(),
        }),
      )
      .returning(["account_id", "nickname", "bio"])
      .executeTakeFirstOrThrow();
    return { accountId: row.account_id, nickname: row.nickname, bio: row.bio };
  }

  public async getDeliverableEmail(
    transaction: DatabaseTransaction,
    accountId: string,
  ): Promise<string | undefined> {
    const row = await transaction
      .selectFrom("identity.accounts")
      .select(["email", "state"])
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    if (row === undefined || row.state !== "active" || row.email === null) return undefined;
    const email = row.email.trim();
    return email === "" ? undefined : email;
  }

  public async exportPrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
  ): Promise<Record<string, unknown>> {
    const account = await transaction
      .selectFrom("identity.accounts")
      .select(["account_id", "email", "state", "created_at", "state_changed_at"])
      .where("account_id", "=", accountId)
      .executeTakeFirstOrThrow();
    const profile = await transaction
      .selectFrom("identity.profiles")
      .select(["nickname", "bio", "updated_at"])
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    return {
      accountId: account.account_id,
      email: account.email,
      state: account.state,
      createdAt: account.created_at.toISOString(),
      stateChangedAt: account.state_changed_at.toISOString(),
      profile:
        profile === undefined
          ? null
          : { nickname: profile.nickname, bio: profile.bio, updatedAt: profile.updated_at.toISOString() },
    };
  }

  public async erasePrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
    requestId: string,
    correlationId: string,
  ): Promise<void> {
    const account = await transaction
      .selectFrom("identity.accounts")
      .select("state")
      .where("account_id", "=", accountId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    await transaction.deleteFrom("identity.profiles").where("account_id", "=", accountId).execute();
    if (account.state === "deleted") return;
    const now = new Date();
    await transaction
      .updateTable("identity.accounts")
      .set({ email: null, state: "deleted", state_reason: `privacy:${requestId}`, state_changed_at: now })
      .where("account_id", "=", accountId)
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto("identity.account_state_events")
      .values({
        account_id: accountId,
        previous_state: account.state,
        next_state: "deleted",
        actor_account_id: accountId,
        reason: `Privacy request ${requestId}`,
        correlation_id: correlationId,
        idempotency_key: `privacy:${requestId}`,
      })
      .onConflict((conflict) => conflict.column("idempotency_key").doNothing())
      .execute();
  }

  public async setModerationSuspension(
    transaction: DatabaseTransaction,
    input: ModerationAccountStateInput,
  ): Promise<void> {
    const account = await transaction
      .selectFrom("identity.accounts")
      .select(["state", "state_reason"])
      .where("account_id", "=", input.accountId)
      .forUpdate()
      .executeTakeFirst();
    if (account === undefined) throw new Error("Moderation target account does not exist");

    const nextState = input.suspended ? "suspended" : "active";
    if (account.state === nextState) {
      if (
        input.suspended &&
        (account.state_reason === null || !account.state_reason.startsWith("moderation:"))
      ) {
        throw new Error("Identity account is suspended outside Moderation authority");
      }
      return;
    }
    if (input.suspended && account.state !== "active") {
      throw new Error(`Identity account cannot be moderation-suspended from ${account.state}`);
    }
    if (
      !input.suspended &&
      (account.state !== "suspended" ||
        account.state_reason === null ||
        !account.state_reason.startsWith("moderation:"))
    ) {
      throw new Error("Identity account suspension is not owned by Moderation");
    }

    await transaction
      .updateTable("identity.accounts")
      .set({
        state: nextState,
        state_reason: input.suspended ? `moderation:${input.reason}` : null,
        state_changed_at: new Date(),
      })
      .where("account_id", "=", input.accountId)
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto("identity.account_state_events")
      .values({
        account_id: input.accountId,
        previous_state: account.state,
        next_state: nextState,
        actor_account_id: input.actorAccountId,
        reason: input.reason,
        correlation_id: input.correlationId,
        idempotency_key: input.idempotencyKey,
      })
      .execute();
  }

  public async provisionAccount(accountId: string, correlationId: string): Promise<AuthorizationSnapshot> {
    return this.database.transaction(async (transaction) => {
      const existing = await transaction
        .selectFrom("identity.accounts")
        .select(["account_id", "state"])
        .where("account_id", "=", accountId)
        .executeTakeFirst();

      if (existing === undefined) {
        await transaction
          .insertInto("identity.accounts")
          .values({ account_id: accountId, email: null })
          .execute();
      } else if (existing.state !== "active") {
        throw new AccountProvisioningBlockedError(existing.state);
      }

      await sql`
        insert into identity.role_assignments (
          account_id,
          role_key,
          assigned_by_account_id,
          reason,
          source,
          correlation_id,
          idempotency_key
        )
        select
          ${accountId}::uuid,
          'member',
          null,
          'Explicit V2 account provisioning',
          'self_provisioning',
          ${correlationId}::uuid,
          'v2-account-provisioning'
        where not exists (
          select 1
          from identity.role_assignments assignment
          left join identity.role_assignment_revocations revocation
            on revocation.assignment_id = assignment.assignment_id
          where assignment.account_id = ${accountId}::uuid
            and assignment.role_key = 'member'
            and revocation.assignment_id is null
            and (assignment.expires_at is null or assignment.expires_at > now())
        )
      `.execute(transaction);

      const snapshot = await this.loadSnapshot(transaction, accountId);
      if (snapshot === undefined) {
        throw new Error("provisioned account could not be reloaded");
      }
      return snapshot;
    });
  }

  private async loadSnapshot(
    executor: DatabaseService["db"] | DatabaseTransaction,
    accountId: string,
  ): Promise<AuthorizationSnapshot | undefined> {
    const result = await sql<AuthorizationRow>`
      select
        account.account_id,
        account.state as account_state,
        capability.capability_key,
        capability.requires_recent_auth,
        capability.minimum_aal,
        capability.requires_live_session
      from identity.accounts account
      left join identity.role_assignments assignment
        on assignment.account_id = account.account_id
        and (assignment.expires_at is null or assignment.expires_at > now())
      left join identity.role_assignment_revocations revocation
        on revocation.assignment_id = assignment.assignment_id
      left join identity.role_capabilities role_capability
        on role_capability.role_key = assignment.role_key
        and revocation.assignment_id is null
      left join identity.capabilities capability
        on capability.capability_key = role_capability.capability_key
      where account.account_id = ${accountId}::uuid
    `.execute(executor);

    const first = result.rows[0];
    if (first === undefined) {
      return undefined;
    }

    const capabilities = new Map<string, CapabilityPolicy>();
    for (const row of result.rows) {
      if (row.capability_key === null) {
        continue;
      }
      capabilities.set(row.capability_key, {
        key: row.capability_key,
        requiresRecentAuth: row.requires_recent_auth === true,
        minimumAal: assuranceLevel(row.minimum_aal),
        requiresLiveSession: row.requires_live_session === true,
      });
    }

    return {
      accountId: first.account_id,
      accountState: first.account_state,
      capabilities,
    };
  }
}
