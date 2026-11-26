import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { ApiError } from "../web/src/api";
import {
  documentPollingInterval,
  replaceDocumentStatus,
} from "../web/src/document-status";

it.each([
  ["ocr", "doc"],
  ["ocr", "doc", "attached"],
])("a late result cannot cancel a newer OCR run for %j", async (...key) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let finish!: (value: unknown) => void;
  let signal!: AbortSignal;
  const request = client
    .fetchQuery({
      queryKey: key,
      queryFn: (context) => {
        signal = context.signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    })
    .catch(() => {});
  await replaceDocumentStatus(client, key, { status: "queued" });
  expect(signal.aborted).toBe(true);
  finish({ status: "done", fields: { recipientName: "old result" } });
  await request;
  expect(client.getQueryData(key)).toEqual({ status: "queued" });
  expect(documentPollingInterval(client.getQueryData(key))).toBe(1500);
  client.clear();
});

it("rechecks status after a transient response failure even when the cache says the job was done", () => {
  expect(
    documentPollingInterval(
      { status: "done" },
      new TypeError("network unavailable"),
    ),
  ).toBe(3000);
  expect(
    documentPollingInterval(
      { status: "processing" },
      new ApiError("not found", 404, {}),
    ),
  ).toBe(false);
  expect(documentPollingInterval({ status: "done" })).toBe(false);
});
