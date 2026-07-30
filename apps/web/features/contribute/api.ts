import type {
  AttachmentReservation,
  AttachmentView,
  CommandResult,
  ContributorAnalytics,
  SubmissionPage,
  SubmissionView,
} from "./types";

interface ApiResult<T> {
  data: T;
  etag: string | null;
}

export class ContributionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // The API always returns JSON on errors; keep a stable fallback for proxy failures.
  }
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : "Contribution request failed";
    throw new ContributionApiError(detail, response.status);
  }
  return { data: body as T, etag: response.headers.get("etag") };
}

export async function createDraft(body: unknown): Promise<ApiResult<CommandResult>> {
  return parseResponse<CommandResult>(
    await fetch("/api/community-intake/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function listSubmissions(cursor?: string): Promise<ApiResult<SubmissionPage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return parseResponse<SubmissionPage>(
    await fetch(`/api/community-intake/submissions${query}`, { cache: "no-store" }),
  );
}

export async function getSubmission(submissionId: string): Promise<ApiResult<SubmissionView>> {
  return parseResponse<SubmissionView>(
    await fetch(`/api/community-intake/submissions/${encodeURIComponent(submissionId)}`, {
      cache: "no-store",
    }),
  );
}

export async function getAnalytics(): Promise<ApiResult<ContributorAnalytics>> {
  return parseResponse<ContributorAnalytics>(
    await fetch("/api/community-intake/analytics", { cache: "no-store" }),
  );
}

export async function runCommand<T = CommandResult>(
  submissionId: string,
  command: string,
  etag: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return parseResponse<T>(
    await fetch(
      `/api/community-intake/submissions/${encodeURIComponent(submissionId)}/commands/${command}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "If-Match": etag },
        body: JSON.stringify(body),
      },
    ),
  );
}

export async function prepareAttachment(
  submissionId: string,
  etag: string,
  body: unknown,
): Promise<ApiResult<AttachmentReservation>> {
  return runCommand<AttachmentReservation>(submissionId, "prepare-attachment", etag, body);
}

export async function uploadAttachment(
  attachmentId: string,
  etag: string,
  uploadReference: string,
  file: File,
): Promise<ApiResult<AttachmentView>> {
  const formData = new FormData();
  formData.set("idempotency_key", `attachment-upload-${crypto.randomUUID()}`);
  formData.set("upload_reference", uploadReference);
  formData.set("file", file, file.name);
  return parseResponse<AttachmentView>(
    await fetch(
      `/api/community-intake/attachments/${encodeURIComponent(attachmentId)}/content`,
      {
        method: "POST",
        headers: { "If-Match": etag },
        body: formData,
      },
    ),
  );
}
