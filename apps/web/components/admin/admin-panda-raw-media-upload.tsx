"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";

interface ReservationRead {
  upload_id: string;
  upload_reference: string;
  expires_at: string;
  upload_path: string;
  state: "reserved";
}

interface UploadRead {
  upload_id: string;
  panda_id: string;
  original_filename: string;
  media_type: string;
  byte_size: number;
  state: "reserved" | "uploaded" | "processing" | "ready" | "rejected";
  content_sha256: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UploadListRead {
  items: UploadRead[];
}

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 20 * 1024 * 1024;

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
    if (payload.detail) return JSON.stringify(payload.detail);
  } catch {
    // Stable fallback below.
  }
  return `Upload request failed (${response.status})`;
}

export function AdminPandaRawMediaUpload({
  pandaId,
  disabled,
}: {
  pandaId: string;
  disabled: boolean;
}) {
  const [uploads, setUploads] = useState<UploadRead[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/media/uploads?panda_id=${encodeURIComponent(pandaId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as UploadListRead;
    setUploads(payload.items);
  }, [pandaId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!allowedTypes.has(file.type)) {
      setError("仅支持 JPEG、PNG 或 WebP 原图。");
      return;
    }
    if (file.size <= 0 || file.size > maxBytes) {
      setError("原图必须小于等于 20 MB。");
      return;
    }
    setWorking(true);
    try {
      const reserve = await fetch("/api/admin/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panda_id: pandaId,
          filename: file.name,
          content_type: file.type,
          byte_size: file.size,
        }),
      });
      if (!reserve.ok) throw new Error(await responseError(reserve));
      const reservation = (await reserve.json()) as ReservationRead;
      const upload = await fetch(reservation.upload_path, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Upload-Reference": reservation.upload_reference,
        },
        body: file,
      });
      if (!upload.ok) throw new Error(await responseError(upload));
      setNotice("原图已进入私有媒体区，等待处理/审核。上传本身不会公开图片。 ");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "原图上传失败。");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mt-5 rounded-lg border border-stone-300 bg-stone-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-stone-950">原始文件上传</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
            原图先进入私有对象存储。完成媒体处理、WebP derivative、版权与来源核验后，再使用下方“公开媒体登记”加入 Change Set。
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-stone-500 bg-white px-4 text-sm font-semibold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40">
          {working ? "正在上传…" : "选择原图"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || working}
            onChange={(event) => void selectFile(event)}
            className="sr-only"
          />
        </label>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-900">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-900">{notice}</p> : null}
      {uploads.length ? (
        <ul className="mt-4 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white px-4">
          {uploads.map((upload) => (
            <li key={upload.upload_id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem] sm:items-center">
              <div className="min-w-0">
                <strong className="block truncate">{upload.original_filename}</strong>
                <span className="text-xs text-stone-500">{upload.media_type} · {(upload.byte_size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <span className="text-sm font-semibold">{upload.state}</span>
              <span className="text-xs text-stone-500">{new Date(upload.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-stone-500">这个 Panda 还没有私有原图上传记录。</p>
      )}
    </section>
  );
}
