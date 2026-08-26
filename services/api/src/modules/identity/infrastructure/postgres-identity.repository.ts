import { sql } from "kysely";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  AssuranceLevel,
  AuthorizationSnapshot,
  CapabilityPolicy,
} from "../application/identity-access.types.js";
import { AccountProvisioningBlockedError } from "../application/identity.errors.js";
import type { IdentityPort } from "../application/identity.port.js";

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

export class PostgresIdentityRepository implements IdentityPort {
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
