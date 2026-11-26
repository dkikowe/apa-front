// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { api, queryClient } from "../web/src/api";
import { ParticipantDetail, Participants } from "../web/src/Participants";
import { defaultFilters } from "../web/src/components/common";

vi.mock("../web/src/api", async (load) => ({
  ...(await load<typeof import("../web/src/api")>()),
  api: vi.fn(),
}));
beforeAll(() => notifyManager.setScheduler(queueMicrotask));
afterAll(() => notifyManager.setScheduler((fn) => setTimeout(fn, 0)));

let root: Root;
const path = "/participants/sample";
const listKey = ["members", { ...defaultFilters, page: 1 }];
async function openProfile(
  archived = false,
  overrides: Record<string, unknown> = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const paymentYear = defaultFilters.year;
  const participant = {
    _id: "sample",
    firstName: "Үлгі",
    lastName: "Сынақ",
    middleName: "Сынаққызы",
    totalPaid: 0,
    remaining: 648700,
    status: "unpaid",
    payments: [],
    archivedAt: archived ? "2026-01-01" : null,
    ...overrides,
  };
  queryClient.setQueryData(["participant", "sample", paymentYear], participant);
  queryClient.setQueryData(["payment-categories"], { items: [] });
  queryClient.setQueryData(listKey, { items: [participant], total: 1 });
  const mount = document.body.appendChild(document.createElement("div"));
  root = createRoot(mount);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/participants/:id" element={<ParticipantDetail />} />
            <Route path="/participants" element={<Participants />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  queryClient.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function button(text: string) {
  const el = [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === text,
  );
  if (!el) throw new Error("Missing button " + text);
  return el;
}
async function click(text: string) {
  await act(async () => button(text).click());
}

it.each([false, true])(
  "offers deletion separately from archiving or restoring and returns focus on cancellation",
  async (archived) => {
    await openProfile(archived);
    expect(
      button(archived ? "Тізімге қайтару" : "Мұрағатқа жіберу"),
    ).toBeDefined();
    const opener = button("Қатысушыны жою");
    await click("Қатысушыны жою");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Сынақ Үлгі Сынаққызы");
    expect(dialog.textContent).toContain(
      "Төлемдері мен чектері есепте сақталады.",
    );
    expect(document.activeElement).toBe(button("Бас тарту"));
    await click("Бас тарту");
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(
      vi
        .mocked(api)
        .mock.calls.some(([, options]) => options?.method === "DELETE"),
    ).toBe(false);
  },
);

it("identifies an incomplete nameless card by the last four IIN digits", async () => {
  await openProfile(false, {
    firstName: "",
    lastName: "",
    middleName: "",
    iin: "000000007777",
  });
  await click("Қатысушыны жою");
  const title = document.querySelector('[role="dialog"] h2')?.textContent;
  expect(title).toContain("ЖСН ····7777");
  expect(title).not.toContain("000000007777");
  await click("Бас тарту");
});

it("handles an uncertain network response, guards double confirmation and refreshes the list after a retry", async () => {
  let fail!: (err: Error) => void;
  const pending = new Promise((_, reject) => {
    fail = reject;
  });
  let requests = 0;
  vi.mocked(api).mockImplementation(async (url, options) => {
    if (options?.method === "DELETE") {
      expect(url).toBe(path);
      return ++requests === 1 ? pending : { ok: true };
    }
    if (url.startsWith("/participants?")) return { items: [], total: 0 };
    throw new Error("Unexpected query " + url);
  });
  await openProfile();
  for (const key of [
    "dashboard-members",
    "statistics",
    "report-count",
    "finance",
  ])
    queryClient.setQueryData([key, 2026], { before: true });
  await click("Қатысушыны жою");
  const confirm = button("Жою");
  await act(async () => {
    confirm.click();
    confirm.click();
  });
  expect(requests).toBe(1);
  expect(confirm.disabled).toBe(true);
  expect(button("Бас тарту").disabled).toBe(true);
  await act(async () => fail(new TypeError("Failed to fetch")));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Байланысты тексеріп",
  );
  expect(confirm.disabled).toBe(false);
  await click("Жою");
  await vi.waitFor(() =>
    expect(document.querySelector("h1")?.textContent).toBe("Қатысушылар"),
  );
  expect(requests).toBe(2);
  expect(document.activeElement).toBe(document.querySelector("h1"));
  expect(queryClient.getQueryData(listKey)).toEqual({ items: [], total: 0 });
  expect(
    queryClient.getQueriesData({ queryKey: ["participant", "sample"] }),
  ).toHaveLength(0);
  for (const key of [
    "dashboard-members",
    "statistics",
    "report-count",
    "finance",
  ])
    expect(queryClient.getQueryData([key, 2026])).toBeUndefined();
});
