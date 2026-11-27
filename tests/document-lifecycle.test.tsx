// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { api, send, queryClient } from "../web/src/api";
import { PaymentForm, ParticipantForm } from "../web/src/components/forms";
import {
  documentPollingInterval,
  readDocumentStatus,
} from "../web/src/document-status";

vi.mock("../web/src/api", async (load) => ({
  ...(await load<typeof import("../web/src/api")>()),
  api: vi.fn(),
  send: vi.fn(),
}));
vi.mock("../web/src/components/common", async (load) => ({
  ...(await load<typeof import("../web/src/components/common")>()),
  Modal: ({ children }: { children: ReactNode }) => (
    <section role="dialog">{children}</section>
  ),
}));
const kinds = ["identity", "receipt"] as const;
type Kind = (typeof kinds)[number];
let root: Root;
beforeAll(() => notifyManager.setScheduler(queueMicrotask));
afterAll(() => notifyManager.setScheduler((fn) => setTimeout(fn, 0)));
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  queryClient.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
async function show(kind: Kind, saved?: Record<string, unknown>) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  queryClient.setQueryDefaults(["ocr"], { retry: false });
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        {kind === "identity" ? (
          <ParticipantForm participant={saved} onClose={() => {}} />
        ) : (
          <PaymentForm
            year={2026}
            participant={{ _id: "person" }}
            payment={saved}
            onClose={() => {}}
          />
        )}
      </QueryClientProvider>,
    ),
  );
}
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!node) throw Error("Missing button " + text);
  return node;
}
function controls(kind: Kind) {
  const identity = kind === "identity";
  const field = (label: string) => {
    const input = [...document.querySelectorAll("label")]
      .find((el) => el.querySelector("span")?.textContent === label)
      ?.querySelector("input");
    if (!input) throw Error("Missing field " + label);
    return input;
  };
  return {
    number: field(identity ? "ЖСН (12 сан)" : "Чек нөмірі"),
    person: field(identity ? "Аты" : "Төлеген адам"),
    save: button(identity ? "Қатысушыны сақтау" : "Төлемді сақтау"),
    choose: button(identity ? "Жеке куәлікті жүктеу" : "Төлем чегін жүктеу"),
  };
}
async function file(name: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["sample"], name)],
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}
async function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!.call(input, value);
  await act(async () =>
    input.dispatchEvent(new Event("input", { bubbles: true })),
  );
}
function fields(kind: Kind, n: string, person: string) {
  return kind === "identity"
    ? { iin: n, firstName: person }
    : { receiptNumber: n, payerName: person };
}
function refetch(key: (string | number)[]) {
  return act(async () => {
    await queryClient.invalidateQueries({ queryKey: key, exact: true });
  });
}
function statusText() {
  return document.querySelector(".upload-box [role=status]")?.textContent ?? "";
}

it("saves a finished identity without sex or Latin names", async () => {
  const id = "65a000000000000000000001";
  vi.mocked(api).mockResolvedValue({
    id,
    status: "done",
    fields: {
      identityMrz: "blank",
      firstName: "Айгүл",
      lastName: "Абаева",
      iin: "000123456789",
      birthDate: "1975-04-15",
      documentNumber: "123456789",
      issuedBy: "МВД РК",
      issueDate: "2020-01-01",
      expiryDate: "2030-01-01",
    },
  });
  vi.mocked(send).mockResolvedValue({});
  await show("identity");
  await file("identity.pdf");
  expect(statusText()).toContain("Жынысы туралы мәлімет табылмады.");
  expect(controls("identity").save.disabled).toBe(false);
  await act(async () =>
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(send).toHaveBeenCalledWith(
    "/participants",
    expect.objectContaining({
      identityDocumentId: id,
      firstName: "Айгүл",
      iin: "000123456789",
      sex: "",
    }),
    "POST",
  );
});

it.each(kinds)(
  "shows trusted %s checkpoints, waits through a dropped status request, keeps a manual correction and unlocks only after final duplicate checks",
  async (kind) => {
    let current = {
      id: "A",
      status: "processing",
      recoveryHasCheckpoint: false,
      fields: fields(kind, "111111111111", "Old cycle"),
    };
    let unavailable = false;
    vi.mocked(api).mockImplementation(async (url) => {
      if (url !== "/documents" && unavailable) throw TypeError("Unavailable");
      return current;
    });
    await show(kind);
    await file("A.pdf");
    const form = controls(kind);
    expect(form.number.value).toBe("");
    expect(form.person.value).toBe("");
    expect(form.save.disabled).toBe(true);
    expect(form.choose.disabled).toBe(false);
    current = {
      ...current,
      status: "queued",
      recoveryHasCheckpoint: true,
      fields: fields(kind, "222222222222", "First pass"),
    };
    await refetch(["ocr", "A"]);
    expect(form.number.value).toBe("222222222222");
    await type(form.person, "Corrected");
    // Clearing a pending result is a manual correction even if it equals the initial default.
    await type(form.person, "");
    unavailable = true;
    await refetch(["ocr", "A"]);
    expect(statusText()).toContain("қайта тексеріледі");
    expect(document.querySelector(".upload-box [role=alert]")).toBeNull();
    expect(form.save.disabled).toBe(true);
    expect(form.choose.disabled).toBe(false);
    unavailable = false;
    current = {
      ...current,
      status: "done",
      fields: fields(kind, "333333333333", "Final pass"),
    };
    await refetch(["ocr", "A"]);
    expect(form.number.value).toBe("333333333333");
    expect(form.person.value).toBe("");
    expect(form.save.disabled).toBe(false);
  },
);

it.each(kinds)(
  "does not publish cached conflicts or in-progress values into the saved %s form; changing its identifier must wait",
  async (kind) => {
    const previous = {
      id: "A",
      status: "duplicate",
      duplicate: { message: "Obsolete cached conflict" },
    };
    queryClient.setQueryData(["ocr", "A", "attached"], previous);
    let finish!: (job: unknown) => void;
    const refresh = new Promise((resolve) => {
      finish = resolve;
    });
    let job = {
      id: "A",
      status: "queued",
      recoveryHasCheckpoint: true,
      fields: fields(kind, "222222222222", "Provisional"),
    };
    vi.mocked(api).mockImplementation(async (url) =>
      url.endsWith("/refresh") ? refresh : job,
    );
    const saved =
      kind === "identity"
        ? { _id: "p", identityDocumentId: "A", iin: "111111111111" }
        : {
            _id: "payment",
            receiptDocumentId: "A",
            amount: 70000,
            receiptNumber: "111111111111",
          };
    await show(kind, saved);
    const form = controls(kind);
    expect(document.body.textContent).not.toContain("Obsolete cached conflict");
    expect(form.save.disabled).toBe(false);
    await act(async () => finish(job));
    expect(form.person.value).toBe("");
    expect(form.number.value).toBe("111111111111");
    expect(form.save.disabled).toBe(false);
    await type(form.number, "444444444444");
    expect(form.save.disabled).toBe(true);
    await type(form.number, "111111111111");
    expect(form.save.disabled).toBe(false);
    await type(form.person, "Correction");
    job = { ...job, status: "done" };
    await refetch(["ocr", "A", "attached"]);
    expect(form.person.value).toBe("Correction");
    expect(form.number.value).toBe("111111111111");
  },
);

it.each(kinds)(
  "can replace unfinished %s A with B and an eventual duplicate blocks saving",
  async (kind) => {
    const jobs = {
      A: {
        id: "A",
        status: "queued",
        recoveryHasCheckpoint: true,
        fields: fields(kind, "111111111111", "First"),
      },
      B: {
        id: "B",
        status: "queued",
        recoveryHasCheckpoint: false,
        fields: {},
      },
    };
    vi.mocked(api).mockImplementation(async (url, options) => {
      const id =
        url === "/documents"
          ? ((options!.body as FormData).get("file") as File).name
          : url.split("/").at(-1);
      return jobs[id as keyof typeof jobs];
    });
    await show(kind);
    await file("A");
    const form = controls(kind);
    expect(form.person.value).toBe("First");
    expect(form.choose.disabled).toBe(false);
    await file("B");
    expect(form.person.value).toBe("");
    expect(form.number.value).toBe("");
    expect(form.save.disabled).toBe(true);
    await act(async () => {
      queryClient.setQueryData(["ocr", "A"], { ...jobs.A, status: "done" });
      queryClient.setQueryData(["ocr", "B"], {
        ...jobs.B,
        status: "duplicate",
        duplicate: { message: "Registered elsewhere" },
      });
    });
    expect(form.person.value).toBe("");
    expect(document.body.textContent).toContain("Registered elsewhere");
    expect(form.save.disabled).toBe(true);
    expect(vi.mocked(send)).not.toHaveBeenCalled();
  },
);

it("polls a deferred server retry without issuing status requests every second", () => {
  expect(
    documentPollingInterval({
      status: "queued",
      nextReadAt: new Date(Date.now() + 90_000).toISOString(),
    }),
  ).toBe(30_000);
  expect(
    documentPollingInterval({
      status: "queued",
      nextReadAt: new Date(Date.now() - 90_000).toISOString(),
    }),
  ).toBe(1500);
});

it("shows the remaining IIN and the scheduled Astana time while identity recovery waits", async () => {
  const next = new Date(Date.now() + 600_000);
  const expectedTime = new Intl.DateTimeFormat("kk-KZ", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(next);
  const job = {
    id: "A",
    status: "queued",
    recoveryHasCheckpoint: true,
    nextReadAt: next.toISOString(),
    fields: {
      firstName: "Айгүл",
      lastName: "Үлгі",
      firstNameLatin: "AIGUL",
      lastNameLatin: "ULGI",
      birthDate: "1960-01-01",
      documentNumber: "000000123",
      issuedBy: "МВД РК",
      issueDate: "2024-01-15",
      expiryDate: "2034-01-14",
    },
  };
  vi.mocked(api).mockResolvedValue(job);
  await show("identity");
  await file("A.pdf");
  expect(statusText()).toContain("ЖСН (12 сан)");
  expect(statusText()).toContain(expectedTime);
  expect(controls("identity").number.value).toBe("");
  expect(controls("identity").save.disabled).toBe(true);
  expect(vi.mocked(send)).not.toHaveBeenCalled();
});

it.each([false, true])(
  "honours the server's permanent-failure flag (%s) instead of an attempt-count limit",
  async (permanent) => {
    const original = {
      id: "A",
      status: "failed",
      attempts: 12,
      permanentReadFailure: permanent,
      fields: {},
      error: "Missing bytes",
    };
    vi.mocked(api).mockResolvedValue(original);
    const retry = vi.mocked(send).mockResolvedValue({ ok: true });
    await show("receipt");
    await file("A");
    const form = controls("receipt");
    expect(form.save.disabled).toBe(permanent);
    const retryButton = [...document.querySelectorAll("button")].find(
      (el) => el.textContent?.trim() === "Қайта оқу",
    );
    if (permanent) {
      expect(retryButton).toBeUndefined();
      return;
    }
    await act(async () => retryButton!.click());
    expect(retry).toHaveBeenCalledWith("/documents/A/retry", {});
    expect(form.save.disabled).toBe(true);
  },
);

it("aborts a stalled status poll without ending OCR and can still fetch its completed result", async () => {
  vi.useFakeTimers();
  try {
    const final = { id: "doc", status: "done" };
    vi.mocked(api)
      .mockImplementationOnce(
        async (_url, options) =>
          new Promise((_resolve, reject) => {
            options!.signal!.addEventListener(
              "abort",
              () => reject(new DOMException("Timed out", "AbortError")),
              { once: true },
            );
          }),
      )
      .mockResolvedValueOnce(final);
    const waiting = expect(readDocumentStatus("doc")).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await waiting;
    expect(
      documentPollingInterval(
        { status: "processing" },
        new DOMException("Timed out", "AbortError"),
      ),
    ).toBe(3000);
    await expect(readDocumentStatus("doc")).resolves.toEqual(final);
    expect(
      vi.mocked(api).mock.calls.every(([url]) => url === "/documents/doc"),
    ).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
