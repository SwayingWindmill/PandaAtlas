import { sql } from "kysely";
import type { DatabaseService, DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { IdentityModerationParticipant } from "../../identity/application/identity-moderation.port.js";
import type {
  ApplySanctionInput,
  ModerationAppeal,
  ModerationAppealDecision,
  ModerationAppealDecisionOutcome,
  ModerationRepository,
  ModerationSanction,
  ModerationSanctionKind,
  ModerationSubject,
  RestoreSanctionInput,
} from "../application/moderation.application.js";

function scopeFor(kind: ModerationSanctionKind): "account" | "submission" | "attachment" | "notification" {
  if (kind === "submission_restricted") return "submission";
  if (kind === "attachment_restricted") return "attachment";
  if (kind === "notification_restricted") return "notification";
  return "account";
}

export class PostgresModerationRepository implements ModerationRepository {
  public constructor(
    private readonly database: DatabaseService,
    private readonly identity: IdentityModerationParticipant,
  ) {}

  public async getSubject(accountId: string): Promise<ModerationSubject> {
    const row = await this.database.db
      .selectFrom("review_moderation.moderation_subjects")
      .selectAll()
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    return row === undefined
      ? {
          accountId,
          version: 1,
          submissionRestricted: false,
          attachmentRestricted: false,
          notificationRestricted: false,
          accountSuspended: false,
          accountClosedForAbuse: false,
          repeatAbuseCount: 0,
        }
      : this.mapSubject(row);
  }

  public async listSanctions(accountId: string): Promise<ModerationSanction[]> {
    const rows = await this.database.db
      .selectFrom("review_moderation.sanctions")
      .selectAll()
      .where("account_id", "=", accountId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((row) => this.mapSanction(row));
  }

  public async applySanction(input: ApplySanctionInput): Promise<ModerationSanction> {
    return this.database.transaction(async (transaction) => {
      const replay = await transaction
        .selectFrom("review_moderation.sanctions")
        .selectAll()
        .where("issued_by_account_id", "=", input.actorAccountId)
        .where("idempotency_key", "=", input.idempotencyKey)
        .executeTakeFirst();
      if (replay !== undefined) return this.mapSanction(replay);

      const subject = await this.lockSubject(transaction, input.accountId);
      const nextVersion = subject.version + 1;
      const startsAt = new Date();
      const sanction = await transaction
        .insertInto("review_moderation.sanctions")
        .values({
          account_id: input.accountId,
          kind: input.kind,
          scope: scopeFor(input.kind),
          reason_code: input.reasonCode,
          internal_explanation: input.internalExplanation,
          user_visible_explanation: input.userVisibleExplanation,
          starts_at: startsAt,
          ends_at: input.kind === "account_closed_for_abuse" ? null : input.endsAt ?? null,
          issued_by_account_id: input.actorAccountId,
          subject_version_before: subject.version,
          subject_version_after: nextVersion,
          correlation_id: input.correlationId,
          idempotency_key: input.idempotencyKey,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await this.applySubjectProjection(transaction, subject, sanction.sanction_id, input.kind, input.endsAt, nextVersion);
      if (input.kind === "account_suspended" || input.kind === "account_closed_for_abuse") {
        await this.identity.setModerationSuspension(transaction, {
          accountId: input.accountId,
          suspended: true,
          actorAccountId: input.actorAccountId,
          reason: `${input.reasonCode}:${input.userVisibleExplanation}`,
          correlationId: input.correlationId,
          idempotencyKey: `moderation-suspend:${input.idempotencyKey}`,
        });
      }
      return this.mapSanction(sanction);
    });
  }

  public async restoreSanction(input: RestoreSanctionInput): Promise<boolean> {
    return this.database.transaction((transaction) => this.restoreIn(transaction, input));
  }

  public async submitAppeal(
    accountId: string,
    sanctionId: string,
    userStatement: string,
  ): Promise<ModerationAppeal | undefined> {
    const sanction = await this.database.db
      .selectFrom("review_moderation.sanctions")
      .selectAll()
      .where("sanction_id", "=", sanctionId)
      .executeTakeFirst();
    if (sanction === undefined || sanction.account_id !== accountId) return undefined;

    const subject = await this.database.db
      .selectFrom("review_moderation.moderation_subjects")
      .selectAll()
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    const restoration = await this.database.db
      .selectFrom("review_moderation.restoration_events")
      .select("restoration_id")
      .where("sanction_id", "=", sanctionId)
      .executeTakeFirst();
    const now = Date.now();
    if (
      subject === undefined ||
      restoration !== undefined ||
      sanction.starts_at.getTime() > now ||
      (sanction.ends_at !== null && sanction.ends_at.getTime() <= now) ||
      !this.isCurrentSanction(subject, sanction.kind, sanction.sanction_id)
    ) {
      return undefined;
    }

    const existing = await this.database.db
      .selectFrom("review_moderation.appeal_cases")
      .selectAll()
      .where("sanction_id", "=", sanctionId)
      .where("state", "!=", "closed")
      .executeTakeFirst();
    if (existing !== undefined) return this.mapAppeal(existing);

    const row = await this.database.db
      .insertInto("review_moderation.appeal_cases")
      .values({ account_id: accountId, sanction_id: sanctionId, user_statement: userStatement })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.mapAppeal(row);
  }

  public async decideAppeal(
    appealCaseId: string,
    actorAccountId: string,
    outcome: ModerationAppealDecisionOutcome,
    internalExplanation: string,
    userVisibleExplanation: string,
    correlationId: string,
  ): Promise<ModerationAppealDecision | undefined> {
    return this.database.transaction(async (transaction) => {
      const appeal = await transaction
        .selectFrom("review_moderation.appeal_cases")
        .selectAll()
        .where("appeal_case_id", "=", appealCaseId)
        .forUpdate()
        .executeTakeFirst();
      if (appeal === undefined || appeal.state === "closed") return undefined;

      const decision = await transaction
        .insertInto("review_moderation.appeal_decisions")
        .values({
          appeal_case_id: appealCaseId,
          outcome,
          internal_explanation: internalExplanation,
          user_visible_explanation: userVisibleExplanation,
          decided_by_account_id: actorAccountId,
        })
        .returning(["decision_id", "appeal_case_id", "outcome", "decided_by_account_id"])
        .executeTakeFirstOrThrow();

      const now = new Date();
      await transaction
        .updateTable("review_moderation.appeal_cases")
        .set({
          state: "closed",
          first_responded_at: sql`coalesce(first_responded_at, ${now})`,
          closed_at: now,
          updated_at: now,
          version: sql`version + 1`,
        })
        .where("appeal_case_id", "=", appealCaseId)
        .executeTakeFirstOrThrow();

      if (outcome === "overturned") {
        await this.restoreIn(transaction, {
          sanctionId: appeal.sanction_id,
          reasonCode: "appeal_overturned",
          internalExplanation,
          userVisibleExplanation,
          actorAccountId,
          correlationId,
          idempotencyKey: `appeal-overturn:${appealCaseId}`,
        });
      }

      return {
        decisionId: decision.decision_id,
        appealCaseId: decision.appeal_case_id,
        outcome: decision.outcome,
        decidedByAccountId: decision.decided_by_account_id,
      };
    });
  }

  private async restoreIn(transaction: DatabaseTransaction, input: RestoreSanctionInput): Promise<boolean> {
    const sanction = await transaction
      .selectFrom("review_moderation.sanctions")
      .selectAll()
      .where("sanction_id", "=", input.sanctionId)
      .forUpdate()
      .executeTakeFirst();
    if (sanction === undefined) return false;
    const existing = await transaction
      .selectFrom("review_moderation.restoration_events")
      .select("restoration_id")
      .where("sanction_id", "=", input.sanctionId)
      .executeTakeFirst();
    if (existing !== undefined) return true;

    const subject = await this.lockSubject(transaction, sanction.account_id);
    if (!this.isCurrentSanction(subject, sanction.kind, sanction.sanction_id)) return false;
    const nextVersion = subject.version + 1;

    await transaction
      .insertInto("review_moderation.restoration_events")
      .values({
        sanction_id: sanction.sanction_id,
        account_id: sanction.account_id,
        reason_code: input.reasonCode,
        internal_explanation: input.internalExplanation,
        user_visible_explanation: input.userVisibleExplanation,
        restored_by_account_id: input.actorAccountId,
        subject_version_before: subject.version,
        subject_version_after: nextVersion,
        correlation_id: input.correlationId,
        idempotency_key: input.idempotencyKey,
      })
      .execute();

    await this.clearSubjectProjection(transaction, sanction.kind, sanction.account_id, nextVersion);
    if (sanction.kind === "account_suspended" || sanction.kind === "account_closed_for_abuse") {
      await this.identity.setModerationSuspension(transaction, {
        accountId: sanction.account_id,
        suspended: false,
        actorAccountId: input.actorAccountId,
        reason: `${input.reasonCode}:${input.userVisibleExplanation}`,
        correlationId: input.correlationId,
        idempotencyKey: `moderation-restore:${input.idempotencyKey}`,
      });
    }
    return true;
  }

  private async lockSubject(transaction: DatabaseTransaction, accountId: string) {
    let subject = await transaction
      .selectFrom("review_moderation.moderation_subjects")
      .selectAll()
      .where("account_id", "=", accountId)
      .forUpdate()
      .executeTakeFirst();
    if (subject === undefined) {
      subject = await transaction
        .insertInto("review_moderation.moderation_subjects")
        .values({ account_id: accountId })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    return subject;
  }

  private async applySubjectProjection(
    transaction: DatabaseTransaction,
    subject: Awaited<ReturnType<PostgresModerationRepository["lockSubject"]>>,
    sanctionId: string,
    kind: ModerationSanctionKind,
    endsAt: Date | undefined,
    nextVersion: number,
  ): Promise<void> {
    const common = { version: nextVersion, updated_at: new Date() };
    if (kind === "warning") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common,
        latest_warning_at: new Date(),
        warning_sanction_id: sanctionId,
      }).where("account_id", "=", subject.account_id).executeTakeFirstOrThrow();
      return;
    }
    const repeatAbuseCount = subject.repeat_abuse_count + 1;
    if (kind === "submission_restricted") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common,
        repeat_abuse_count: repeatAbuseCount,
        submission_restricted: true,
        submission_restricted_until: endsAt ?? null,
        submission_sanction_id: sanctionId,
      }).where("account_id", "=", subject.account_id).executeTakeFirstOrThrow();
      return;
    }
    if (kind === "attachment_restricted") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common,
        repeat_abuse_count: repeatAbuseCount,
        attachment_restricted: true,
        attachment_restricted_until: endsAt ?? null,
        attachment_sanction_id: sanctionId,
      }).where("account_id", "=", subject.account_id).executeTakeFirstOrThrow();
      return;
    }
    if (kind === "notification_restricted") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common,
        repeat_abuse_count: repeatAbuseCount,
        notification_restricted: true,
        notification_restricted_until: endsAt ?? null,
        notification_sanction_id: sanctionId,
      }).where("account_id", "=", subject.account_id).executeTakeFirstOrThrow();
      return;
    }
    await transaction.updateTable("review_moderation.moderation_subjects").set({
      ...common,
      repeat_abuse_count: repeatAbuseCount,
      account_suspended: true,
      account_closed_for_abuse: kind === "account_closed_for_abuse",
      account_restricted_until: kind === "account_closed_for_abuse" ? null : endsAt ?? null,
      account_sanction_id: sanctionId,
    }).where("account_id", "=", subject.account_id).executeTakeFirstOrThrow();
  }

  private async clearSubjectProjection(
    transaction: DatabaseTransaction,
    kind: ModerationSanctionKind,
    accountId: string,
    nextVersion: number,
  ): Promise<void> {
    const common = { version: nextVersion, updated_at: new Date() };
    if (kind === "warning") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common, latest_warning_at: null, warning_sanction_id: null,
      }).where("account_id", "=", accountId).executeTakeFirstOrThrow();
      return;
    }
    if (kind === "submission_restricted") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common, submission_restricted: false, submission_restricted_until: null, submission_sanction_id: null,
      }).where("account_id", "=", accountId).executeTakeFirstOrThrow();
      return;
    }
    if (kind === "attachment_restricted") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common, attachment_restricted: false, attachment_restricted_until: null, attachment_sanction_id: null,
      }).where("account_id", "=", accountId).executeTakeFirstOrThrow();
      return;
    }
    if (kind === "notification_restricted") {
      await transaction.updateTable("review_moderation.moderation_subjects").set({
        ...common, notification_restricted: false, notification_restricted_until: null, notification_sanction_id: null,
      }).where("account_id", "=", accountId).executeTakeFirstOrThrow();
      return;
    }
    await transaction.updateTable("review_moderation.moderation_subjects").set({
      ...common,
      account_suspended: false,
      account_closed_for_abuse: false,
      account_restricted_until: null,
      account_sanction_id: null,
    }).where("account_id", "=", accountId).executeTakeFirstOrThrow();
  }

  private isCurrentSanction(
    subject: Awaited<ReturnType<PostgresModerationRepository["lockSubject"]>>,
    kind: ModerationSanctionKind,
    sanctionId: string,
  ): boolean {
    if (kind === "warning") return subject.warning_sanction_id === sanctionId;
    if (kind === "submission_restricted") return subject.submission_sanction_id === sanctionId;
    if (kind === "attachment_restricted") return subject.attachment_sanction_id === sanctionId;
    if (kind === "notification_restricted") return subject.notification_sanction_id === sanctionId;
    return subject.account_sanction_id === sanctionId;
  }

  private mapSubject(row: {
    account_id: string;
    version: number;
    submission_restricted: boolean;
    attachment_restricted: boolean;
    notification_restricted: boolean;
    account_suspended: boolean;
    account_closed_for_abuse: boolean;
    repeat_abuse_count: number;
  }): ModerationSubject {
    return {
      accountId: row.account_id,
      version: row.version,
      submissionRestricted: row.submission_restricted,
      attachmentRestricted: row.attachment_restricted,
      notificationRestricted: row.notification_restricted,
      accountSuspended: row.account_suspended,
      accountClosedForAbuse: row.account_closed_for_abuse,
      repeatAbuseCount: row.repeat_abuse_count,
    };
  }

  private mapSanction(row: {
    sanction_id: string;
    account_id: string;
    kind: string;
    reason_code: string;
    starts_at: Date;
    ends_at: Date | null;
    created_at: Date;
  }): ModerationSanction {
    return {
      sanctionId: row.sanction_id,
      accountId: row.account_id,
      kind: row.kind as ModerationSanctionKind,
      reasonCode: row.reason_code,
      startsAt: row.starts_at,
      ...(row.ends_at === null ? {} : { endsAt: row.ends_at }),
      createdAt: row.created_at,
    };
  }

  private mapAppeal(row: {
    appeal_case_id: string;
    account_id: string;
    sanction_id: string;
    state: "open" | "under_review" | "closed";
    version: number;
    user_statement: string;
  }): ModerationAppeal {
    return {
      appealCaseId: row.appeal_case_id,
      accountId: row.account_id,
      sanctionId: row.sanction_id,
      state: row.state,
      version: row.version,
      userStatement: row.user_statement,
    };
  }
}
