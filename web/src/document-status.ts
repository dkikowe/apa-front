import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import {
  IDENTITY_OCR_FIELDS,
  receiptAutofillUpdates,
} from "../../shared/document-recognition";

type OcrStatus = {
  status?: string;
  fields?: Record<string, unknown>;
  wrongDocumentKind?: boolean;
  nextReadAt?: string | null;
  recoveryHasCheckpoint?: boolean;
  permanentReadFailure?: boolean;
};
export type PreviousAttachment = {
  id: string;
  fields: Record<string, string | number>;
};

export function failedAttachmentBlocksSave(
  job: OcrStatus | undefined,
  sameSavedAttachment: boolean,
  replacedRecognizedDocument: boolean,
) {
  return (
    job?.status === "failed" &&
    !sameSavedAttachment &&
    (job.wrongDocumentKind === true ||
      job.permanentReadFailure === true ||
      replacedRecognizedDocument)
  );
}

export function previousAttachmentChanges(
  kind: "identity" | "receipt",
  previous: PreviousAttachment,
  savedId: string | undefined,
  current: Record<string, unknown>,
  edited: (key: string) => boolean,
) {
  const source =
    kind === "identity"
      ? previous.fields
      : receiptAutofillUpdates(previous.fields, {}, new Set(), false);
  const keys = kind === "identity" ? IDENTITY_OCR_FIELDS : Object.keys(source);
  const clear: Record<string, string> = {};
  const preserve: string[] = [];
  for (const key of keys) {
    if (!current[key] || edited(key)) continue;
    if (current[key] === source[key]) clear[key] = "";
    else if (previous.id === savedId) preserve.push(key);
  }
  return { clear, preserve };
}

// A GET started before requeueing may resolve after the mutation. Cancel the
// in-flight query before publishing its newer status to every observer.
export async function replaceDocumentStatus(
  client: QueryClient,
  key: QueryKey,
  value: OcrStatus,
) {
  await client.cancelQueries({ queryKey: key, exact: true });
  client.setQueryData(key, value);
}

// A stalled HTTP response would otherwise suppress every subsequent poll.
// Aborting this status request leaves the server's recognition job running.
export async function readDocumentStatus(
  id: string,
  refresh = false,
  cancel?: AbortSignal,
) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  const timer = setTimeout(stop, 20_000);
  if (cancel?.aborted) stop();
  else cancel?.addEventListener("abort", stop, { once: true });
  try {
    return await api(`/documents/${id}${refresh ? "/refresh" : ""}`, {
      ...(refresh ? { method: "POST", body: "{}" } : {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    cancel?.removeEventListener("abort", stop);
  }
}

export function statusAccessError(error: unknown): error is ApiError {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}

export function documentPollingInterval(data?: OcrStatus, error?: unknown) {
  if (statusAccessError(error)) return false;
  if (error) return 3000;
  if (["done", "duplicate", "failed"].includes(data?.status ?? ""))
    return false;
  if (data?.status === "queued" && data.nextReadAt) {
    const delay = Date.parse(data.nextReadAt) - Date.now();
    if (delay > 1500) return Math.min(delay, 30_000);
  }
  return 1500;
}
