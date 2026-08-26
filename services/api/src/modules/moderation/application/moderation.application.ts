export type ModerationSanctionKind =
  | "warning"
  | "submission_restricted"
  | "attachment_restricted"
  | "notification_restricted"
  | "account_suspended"
  | "account_closed_for_abuse";

export type ModerationAppealDecisionOutcome = "upheld" | "modified" | "overturned" | "dismissed";

export interface ApplySanctionInput {
  accountId: string;
  kind: ModerationSanctionKind;
  reasonCode: string;
  internalExplanation: string;
  userVisibleExplanation: string;
  endsAt?: Date;
  actorAccountId: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface RestoreSanctionInput {
  sanctionId: string;
  reasonCode: string;
  internalExplanation: string;
  userVisibleExplanation: string;
  actorAccountId: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface ModerationSanction {
  sanctionId: string;
  accountId: string;
  kind: ModerationSanctionKind;
  reasonCode: string;
  startsAt: Date;
  endsAt?: Date;
  createdAt: Date;
}

export interface ModerationSubject {
  accountId: string;
  version: number;
  submissionRestricted: boolean;
  attachmentRestricted: boolean;
  notificationRestricted: boolean;
  accountSuspended: boolean;
  accountClosedForAbuse: boolean;
  repeatAbuseCount: number;
}

export interface ModerationAppeal {
  appealCaseId: string;
  accountId: string;
  sanctionId: string;
  state: "open" | "under_review" | "closed";
  version: number;
  userStatement: string;
}

export interface ModerationAppealDecision {
  decisionId: string;
  appealCaseId: string;
  outcome: ModerationAppealDecisionOutcome;
  decidedByAccountId: string;
}

export interface ModerationRepository {
  getSubject(accountId: string): Promise<ModerationSubject>;
  listSanctions(accountId: string): Promise<ModerationSanction[]>;
  applySanction(input: ApplySanctionInput): Promise<ModerationSanction>;
  restoreSanction(input: RestoreSanctionInput): Promise<boolean>;
  submitAppeal(accountId: string, sanctionId: string, userStatement: string): Promise<ModerationAppeal | undefined>;
  decideAppeal(
    appealCaseId: string,
    actorAccountId: string,
    outcome: ModerationAppealDecisionOutcome,
    internalExplanation: string,
    userVisibleExplanation: string,
    correlationId: string,
  ): Promise<ModerationAppealDecision | undefined>;
}

export type ModerationPort = ModerationRepository;

export const MODERATION_REPOSITORY = Symbol("MODERATION_REPOSITORY");
export const MODERATION_PORT = Symbol("MODERATION_PORT");

export class ModerationApplication implements ModerationPort {
  public constructor(private readonly repository: ModerationRepository) {}

  public getSubject(accountId: string): Promise<ModerationSubject> {
    return this.repository.getSubject(accountId);
  }

  public listSanctions(accountId: string): Promise<ModerationSanction[]> {
    return this.repository.listSanctions(accountId);
  }

  public applySanction(input: ApplySanctionInput): Promise<ModerationSanction> {
    return this.repository.applySanction(input);
  }

  public restoreSanction(input: RestoreSanctionInput): Promise<boolean> {
    return this.repository.restoreSanction(input);
  }

  public submitAppeal(accountId: string, sanctionId: string, userStatement: string): Promise<ModerationAppeal | undefined> {
    return this.repository.submitAppeal(accountId, sanctionId, userStatement);
  }

  public decideAppeal(
    appealCaseId: string,
    actorAccountId: string,
    outcome: ModerationAppealDecisionOutcome,
    internalExplanation: string,
    userVisibleExplanation: string,
    correlationId: string,
  ): Promise<ModerationAppealDecision | undefined> {
    return this.repository.decideAppeal(
      appealCaseId,
      actorAccountId,
      outcome,
      internalExplanation,
      userVisibleExplanation,
      correlationId,
    );
  }
}
