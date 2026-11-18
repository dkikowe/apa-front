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
export async function openDocument(id: string) {
  const tab = window.open("about:blank", "_blank");
  try {
    const { url } = await api(`/documents/${id}/url`);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else window.location.assign(url);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
