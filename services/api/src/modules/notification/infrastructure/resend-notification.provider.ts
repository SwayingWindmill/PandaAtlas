import { Resend } from "resend";
import type { AppConfig } from "../../../platform/config/app-config.js";
import {
  NotificationProviderError,
  type NotificationEmailInput,
  type NotificationEmailResult,
  type NotificationProviderPort,
} from "../application/notification-provider.port.js";

export class ResendNotificationProvider implements NotificationProviderPort {
  public constructor(private readonly config: AppConfig) {}

  public async sendEmail(input: NotificationEmailInput): Promise<NotificationEmailResult> {
    const credential = this.config.resendApiKey;
    const from = this.config.resendFromEmail;
    if (credential === undefined || from === undefined) {
      throw new NotificationProviderError(
        "resend_not_configured",
        false,
        "Resend email delivery is not configured",
      );
    }

    let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
    try {
      const resend = new Resend(credential);
      result = await resend.emails.send(
        {
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
        },
        { idempotencyKey: input.jobId },
      );
    } catch (error) {
      throw new NotificationProviderError(
        "resend_transport",
        true,
        error instanceof Error ? error.message : "Resend transport failed",
      );
    }

    if (result.error !== null) {
      const statusCode = "statusCode" in result.error ? Number(result.error.statusCode) : 0;
      const retryable = statusCode === 429 || statusCode >= 500;
      throw new NotificationProviderError(
        statusCode > 0 ? `resend_http_${statusCode}` : "resend_provider_error",
        retryable,
        result.error.message,
      );
    }
    if (result.data === null || typeof result.data.id !== "string" || result.data.id.trim() === "") {
      throw new NotificationProviderError("resend_invalid_response", false, "Resend did not return a message id");
    }
    return { provider: "resend", providerMessageId: result.data.id };
  }
}
