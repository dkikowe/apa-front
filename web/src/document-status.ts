import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { ApiError } from "./api";

type OcrStatus = { status?: string; fields?: Record<string, unknown> };

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
