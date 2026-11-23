import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  AppConfig,
  type OpsAlertWebhookFormat,
  parseOpsAlertWebhookFormat,
  parseOpsAlertWebhookUrl,
} from "../config/app-config.js";
import { OpsAlertRuntimeService } from "./ops-alert-runtime.service.js";
import { StructuredLoggerService } from "./structured-logger.service.js";

export type OpsAlertSeverity = "critical" | "warning" | "info";
export type OpsAlertCategory =
  | "api_5xx"
  | "cron_failure"
  | "contribution_submitted"
  | "account_deletion_requested";

export type OpsAlertMetadataValue = string | number | boolean | undefined;

export interface OpsAlertEvent {
  severity: OpsAlertSeverity;
  category: OpsAlertCategory;
  title: string;
  summary: string;
  dedupeKey?: string;
  cooldownMs?: number;
  metadata?: Record<string, OpsAlertMetadataValue>;
}

export type OpsAlertFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface OpsAlertTransport {
  fetch?: OpsAlertFetch;
  now?: () => number;
  timeoutMs?: number;
}

export const OPS_ALERT_TRANSPORT = Symbol("OPS_ALERT_TRANSPORT");

const DEFAULT_TIMEOUT_MS = 5_000;
const PRUNE_THRESHOLD = 200;
const MAX_COOLDOWN_ENTRIES = 500;

const ALLOWED_METADATA_KEYS = new Set<string>([
  "requestId",
  "method",
  "path",
  "status",
  "code",
  "errorName",
  "submissionId",
  "submissionType",
  "targetPandaId",
  "privacyRequestId",
  "kind",
]);

function sanitizeMetadata(
  metadata: Record<string, OpsAlertMetadataValue> | undefined,
): Record<string, string | number | boolean> {
  if (metadata === undefined) return {};
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key) || value === undefined) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function formatTextMessage(
  event: OpsAlertEvent,
  metadata: Record<string, string | number | boolean>,
): string {
  const lines = [`[Zhipanda ${event.severity.toUpperCase()}] ${event.title}`, event.summary];
  const details = Object.entries(metadata)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
  if (details !== "") lines.push(details);
  return lines.join("\n");
}

export function buildOpsAlertPayload(
  format: OpsAlertWebhookFormat,
  event: OpsAlertEvent,
): Record<string, unknown> {
  const metadata = sanitizeMetadata(event.metadata);
  const text = formatTextMessage(event, metadata);
  if (format === "feishu") {
    return { msg_type: "text", content: { text } };
  }
  if (format === "wecom") {
    return { msgtype: "text", text: { content: text } };
  }
  return {
    event: event.category,
    severity: event.severity,
    title: event.title,
    summary: event.summary,
    text,
    metadata,
  };
}

/** Dispatches zero-PII operational webhook alerts without impacting request latency or error paths. */
@Injectable()
export class OpsAlertService {
  private readonly cooldowns = new Map<string, number>();
  private readonly sendFetch: OpsAlertFetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: StructuredLoggerService,
    @Optional() private readonly runtime?: OpsAlertRuntimeService,
    @Optional() @Inject(OPS_ALERT_TRANSPORT) transport?: OpsAlertTransport,
  ) {
    this.sendFetch = transport?.fetch ?? ((url, init) => fetch(url, init));
    this.now = transport?.now ?? (() => Date.now());
    this.timeoutMs = transport?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public notify(event: OpsAlertEvent): Promise<void> {
    const runtimeState = this.runtime?.current();
    const target = this.resolveTarget(runtimeState?.webhookUrl, runtimeState?.webhookFormat);
    if (target === undefined) return Promise.resolve();

    const now = this.now();
    if (event.dedupeKey !== undefined && event.cooldownMs !== undefined && event.cooldownMs > 0) {
      const expiresAt = this.cooldowns.get(event.dedupeKey);
      if (expiresAt !== undefined && expiresAt > now) {
        return Promise.resolve();
      }
      this.recordCooldown(event.dedupeKey, now + event.cooldownMs, now);
    }

    const payload = buildOpsAlertPayload(target.format, event);
    const delivery = this.deliver(target.url, payload, event.category);
    runtimeState?.waitUntil?.(delivery);
    return delivery;
  }

  private resolveTarget(
    runtimeWebhookUrl: unknown,
    runtimeWebhookFormat: unknown,
  ): { url: string; format: OpsAlertWebhookFormat } | undefined {
    let url = this.config.opsAlertWebhookUrl;
    if (typeof runtimeWebhookUrl === "string" && runtimeWebhookUrl.trim() !== "") {
      try {
        url = parseOpsAlertWebhookUrl(runtimeWebhookUrl, this.config.environment);
      } catch (error) {
        this.logger.write("warn", "Ops alert configuration is invalid", {
          errorName: error instanceof Error ? error.name : "NonError",
        });
        return undefined;
      }
    }
    if (url === undefined) return undefined;

    let format = this.config.opsAlertWebhookFormat;
    if (typeof runtimeWebhookFormat === "string" && runtimeWebhookFormat.trim() !== "") {
      try {
        format = parseOpsAlertWebhookFormat(runtimeWebhookFormat);
      } catch {
        format = this.config.opsAlertWebhookFormat;
      }
    }
    return { url, format };
  }

  private recordCooldown(key: string, expiresAt: number, now: number): void {
    if (this.cooldowns.size > PRUNE_THRESHOLD) {
      for (const [entryKey, entryExpiry] of this.cooldowns) {
        if (entryExpiry <= now) this.cooldowns.delete(entryKey);
      }
    }
    while (this.cooldowns.size >= MAX_COOLDOWN_ENTRIES) {
      const oldest = this.cooldowns.keys().next().value;
      if (oldest === undefined) break;
      this.cooldowns.delete(oldest);
    }
    this.cooldowns.delete(key);
    this.cooldowns.set(key, expiresAt);
  }

  private async deliver(
    url: string,
    payload: Record<string, unknown>,
    category: OpsAlertCategory,
  ): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.sendFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.write("warn", "Ops alert delivery failed", {
          category,
          status: response.status,
        });
      }
    } catch (error) {
      this.logger.write("warn", "Ops alert delivery failed", {
        category,
        errorName: error instanceof Error ? error.name : "NonError",
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
