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
