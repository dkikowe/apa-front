import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { ApiError } from "./api";
import {
  IDENTITY_OCR_FIELDS,
  receiptAutofillUpdates,
} from "../../shared/document-recognition";

type OcrStatus = {
  status?: string;
  fields?: Record<string, unknown>;
  wrongDocumentKind?: boolean;
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
    (job.wrongDocumentKind === true || replacedRecognizedDocument)
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

export function documentPollingInterval(data?: OcrStatus, error?: unknown) {
  if (error instanceof ApiError && [401, 403, 404].includes(error.status))
    return false;
  if (error) return 3000;
  return ["done", "duplicate", "failed"].includes(data?.status ?? "")
    ? false
    : 1500;
}
