export interface NotificationEmailInput {
  jobId: string;
  to: string;
  subject: string;
  text: string;
}

export interface NotificationEmailResult {
  provider: string;
  providerMessageId: string;
}

export interface NotificationProviderPort {
  sendEmail(input: NotificationEmailInput): Promise<NotificationEmailResult>;
}

export interface NotificationPushInput {
  jobId: string;
  toTokens: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface NotificationPushResult {
  provider: "expo";
  deliveredTicketIds: string[];
  unregisteredTokens: string[];
}

export interface NotificationPushProviderPort {
  sendPush(input: NotificationPushInput): Promise<NotificationPushResult>;
}

export class NotificationProviderError extends Error {
  public constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "NotificationProviderError";
  }
}

export const NOTIFICATION_PROVIDER_PORT = Symbol("NOTIFICATION_PROVIDER_PORT");
export const NOTIFICATION_PUSH_PROVIDER_PORT = Symbol("NOTIFICATION_PUSH_PROVIDER_PORT");
