import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 20000, refetchOnWindowFocus: false },
  },
});
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: any,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("x-csrf-token", csrf);
  const res = await fetch("/api" + url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ message: "Байланыс үзілді. Қайта көріңіз." }));
    if (res.status === 401 && !url.startsWith("/auth")) {
      queryClient.setQueryData(["me"], null);
      csrf = "";
    }
    throw new ApiError(data.message || "Қате орын алды.", res.status, data);
  }
  return res.json();
}
export const send = (url: string, body: any, method = "POST") =>
  api(url, { method, body: JSON.stringify(body) });
export function qs(obj: Record<string, any>) {
  return new URLSearchParams(
    Object.entries(obj)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
export async function downloadReport(
  type: string,
  filters: Record<string, any>,
) {
  const res = await fetch(`/api/reports/${type}?${qs(filters)}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}-${filters.year}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function getDocumentFile(id: string, signal: AbortSignal) {
  const meta = await api<{ mime: string; originalName?: string }>(
    `/documents/${id}`,
    { signal },
  );
  if (!["application/pdf", "image/jpeg", "image/png"].includes(meta.mime))
    throw new Error("Құжаттың бұл түрін көрсету мүмкін емес.");
  const response = await fetch(`/api/documents/${id}/content`, {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) {
      csrf = "";
      queryClient.setQueryData(["me"], null);
    }
    throw new Error(error.message || "Құжат жүктелмеді. Қайта көріңіз.");
  }
  return {
    blob: await response.blob(),
    mime: meta.mime,
    name:
      meta.originalName ||
      `document-${id}.${meta.mime === "application/pdf" ? "pdf" : meta.mime === "image/png" ? "png" : "jpg"}`,
  };
}
