import type { AppConfig } from "../../../platform/config/app-config.js";
import {
  NotificationProviderError,
  type NotificationPushInput,
  type NotificationPushProviderPort,
  type NotificationPushResult,
} from "../application/notification-provider.port.js";

const EXPO_BATCH_LIMIT = 100;
const EXPO_REQUEST_TIMEOUT_MS = 10_000;

interface ExpoTicketError {
  code?: string;
  message?: string;
}

interface ExpoPushTicket {
  status?: unknown;
  id?: unknown;
  message?: unknown;
  details?: { error?: unknown } | null;
}

function mapExpoTicketErrorCode(rawCode: string | undefined): { code: string; retryable: boolean } {
  if (rawCode === "MessageRateExceeded") {
    return { code: "expo_rate_limited", retryable: true };
  }
  if (rawCode === "InvalidCredentials") {
    return { code: "expo_invalid_credentials", retryable: false };
  }
  if (rawCode === "MessageTooBig") {
    return { code: "expo_message_too_big", retryable: false };
  }
  if (rawCode === undefined || rawCode.trim() === "") {
    return { code: "expo_ticket_error", retryable: false };
  }
  const snake = rawCode
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .toLowerCase();
  return { code: `expo_${snake}`, retryable: false };
}

export class ExpoPushNotificationProvider implements NotificationPushProviderPort {
  public constructor(
    private readonly config: AppConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  public async sendPush(input: NotificationPushInput): Promise<NotificationPushResult> {
    if (input.toTokens.length === 0) {
      return { provider: "expo", deliveredTicketIds: [], unregisteredTokens: [] };
    }

    const deliveredTicketIds: string[] = [];
    const unregisteredTokens: string[] = [];
    let firstFailure: { code: string; retryable: boolean; message: string } | undefined;

    for (let offset = 0; offset < input.toTokens.length; offset += EXPO_BATCH_LIMIT) {
      const chunk = input.toTokens.slice(offset, offset + EXPO_BATCH_LIMIT);
      const tickets = await this.sendChunk(chunk, input);

      tickets.forEach((ticket, index) => {
        const token = chunk[index]!;
        if (ticket.status === "ok" && typeof ticket.id === "string" && ticket.id.trim() !== "") {
          deliveredTicketIds.push(ticket.id);
          return;
        }
        const rawError =
          ticket.details !== null && typeof ticket.details === "object" && typeof ticket.details.error === "string"
            ? ticket.details.error
            : undefined;
        if (rawError === "DeviceNotRegistered") {
          unregisteredTokens.push(token);
          return;
        }
        if (firstFailure === undefined) {
          const mapped = mapExpoTicketErrorCode(rawError);
          firstFailure = {
            ...mapped,
            message:
              typeof ticket.message === "string" && ticket.message.trim() !== ""
                ? ticket.message
                : `Expo push ticket failed for job ${input.jobId}`,
          };
        }
      });
    }

    if (deliveredTicketIds.length === 0 && firstFailure !== undefined) {
      throw new NotificationProviderError(firstFailure.code, firstFailure.retryable, firstFailure.message);
    }

    return {
      provider: "expo",
      deliveredTicketIds,
      unregisteredTokens,
    };
  }

  private async sendChunk(chunk: string[], input: NotificationPushInput): Promise<ExpoPushTicket[]> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "accept-encoding": "gzip, deflate",
      "content-type": "application/json",
    };
    const token = this.config.expoAccessToken;
    if (token !== undefined) {
      headers.authorization = `Bearer ${token}`;
    }

    const payload = chunk.map((to) => ({
      to,
      title: input.title,
      body: input.body,
      data: input.data,
      sound: "default",
    }));

    let response: Response;
    try {
      response = await this.fetchImpl(this.config.expoPushEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(EXPO_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new NotificationProviderError(
        "expo_transport",
        true,
        error instanceof Error ? error.message : "Expo push transport failed",
      );
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      const bodyText = await response.text().catch(() => "");
      throw new NotificationProviderError(
        `expo_http_${response.status}`,
        retryable,
        bodyText.trim() !== "" ? `Expo HTTP ${response.status}: ${bodyText}` : `Expo HTTP ${response.status}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new NotificationProviderError("expo_invalid_response", false, "Expo push response was not valid JSON");
    }

    if (parsed === null || typeof parsed !== "object") {
      throw new NotificationProviderError("expo_invalid_response", false, "Expo push response was not an object");
    }

    const record = parsed as { data?: unknown; errors?: ExpoTicketError[] };
    if (Array.isArray(record.errors) && record.errors.length > 0 && !Array.isArray(record.data)) {
      const firstError = record.errors[0];
      const mapped = mapExpoTicketErrorCode(firstError?.code);
      throw new NotificationProviderError(
        mapped.code,
        mapped.retryable,
        firstError?.message ?? "Expo push API rejected the request",
      );
    }

    if (!Array.isArray(record.data) || record.data.length !== chunk.length) {
      throw new NotificationProviderError(
        "expo_invalid_response",
        false,
        "Expo push response did not return one ticket per token",
      );
    }

    return record.data as ExpoPushTicket[];
  }
}
