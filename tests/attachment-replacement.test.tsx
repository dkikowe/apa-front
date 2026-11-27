// @vitest-environment happy-dom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { ParticipantForm, PaymentForm } from "../web/src/components/forms";
import { ParticipantDetail } from "../web/src/Participants";
import { api, send, queryClient } from "../web/src/api";

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

let root: Root;
// Flush query notifications inside React's act scope in this DOM test.
beforeAll(() => notifyManager.setScheduler(queueMicrotask));
afterAll(() => notifyManager.setScheduler((notify) => setTimeout(notify, 0)));
async function mount(children: ReactNode) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const target = document.createElement("div");
  document.body.append(target);
  root = createRoot(target);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        {children}
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

function field(label: string) {
  const node = [...document.querySelectorAll("label")].find(
    (el) => el.querySelector("span")?.textContent === label,
  );
  if (!node) throw new Error("Missing field " + label);
  return node.querySelector("input")!;
}
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find(
    (el) => el.textContent?.trim() === text,
  );
  if (!node) throw new Error("Missing button " + text);
  return node;
}
async function chooseFile(name: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["sample"], name)],
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

async function typeValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  inputType = "insertText",
) {
  const prototype =
    input instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
  await act(async () =>
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType })),
  );
}
function textBox() {
  return document.querySelector<HTMLTextAreaElement>(
    ".receipt-text-input textarea",
  )!;
}

const forwardedReceipt = {
  text: "Оплата 6 487 ₸\n№ чека QR00000000821\nФИО покупателя Үлгі А.\nОплачено с Kaspi Gold",
  fields: {
    amount: 648700,
    receiptNumber: "QR00000000821",
    payerName: "Үлгі А.",
    recipientName: 'ОО "URSHYK"',
    paymentDate: "2026-08-12",
    paymentTime: "10:00",
    receiptType: "urshyk",
    method: "Kaspi Gold",
  },
};

it.each([
  { kind: "membership", category: undefined },
  {
    kind: "additional",
    category: { _id: "addon", name: "Көрме", amount: 350000 },
  },
])(
  "reads pasted text in the $kind form and saves only after confirmation",
  async ({ kind, category }) => {
    const close = vi.fn();
    vi.mocked(send)
      .mockResolvedValueOnce({ fields: forwardedReceipt.fields })
      .mockResolvedValueOnce({});
    await mount(
      <PaymentForm
        participant={{ _id: "member" }}
        initialCategory={category}
        year={2026}
        onClose={close}
      />,
    );
    const text = textBox();
    expect(text.closest("details")).toBeNull();
    expect(text.closest("label")?.textContent).toContain(
      "WhatsApp-тағы чек мәтінін қойыңыз",
    );
    await typeValue(text, forwardedReceipt.text, "insertFromPaste");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("/receipts/recognize-text", {
      text: forwardedReceipt.text,
      paymentId: undefined,
    });
    expect(field("Төленген сома, ₸ *").value).toBe("6487");
    expect(field("Төлеген адам").value).toBe(forwardedReceipt.fields.payerName);
    expect(field("Төлем тәсілі").value).toBe("Kaspi Gold");
    const save = button("Төлемді сақтау");
    await typeValue(field("Чек нөмірі"), "ANOTHER");
    expect(save.disabled).toBe(true);
    await typeValue(field("Чек нөмірі"), forwardedReceipt.fields.receiptNumber);
    expect(save.disabled).toBe(false);
    await act(async () =>
      document
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(
      "/participants/member/payments",
      expect.objectContaining({
        ...forwardedReceipt.fields,
        receiptText: forwardedReceipt.text,
        paymentKind: kind,
        paymentCategoryId: category?._id || "",
      }),
      "POST",
    );
    expect(close).toHaveBeenCalledTimes(1);
  },
);

it("blocks duplicate pasted text and cancels without registering a payment", async () => {
  const close = vi.fn();
  vi.mocked(send).mockRejectedValueOnce(new Error("Бұл чек бұрын тіркелген."));
  await mount(
    <PaymentForm participant={{ _id: "member" }} year={2026} onClose={close} />,
  );
  await typeValue(textBox(), forwardedReceipt.text, "insertFromPaste");
  expect(document.querySelector('[role="status"]')?.textContent).toBe(
    "Бұл чек бұрын тіркелген.",
  );
  expect(button("Төлемді сақтау").disabled).toBe(true);
  await act(async () => button("Бас тарту").click());
  expect(close).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
});

it("rejects conflicting or unnumbered WhatsApp text without altering the selected file, then accepts matching text", async () => {
  const file = {
    id: "A",
    status: "done",
    fields: { amount: 160000, receiptNumber: "QR915" },
  };
  vi.mocked(api).mockResolvedValue(file);
  vi.mocked(send)
    .mockResolvedValueOnce({
      fields: { amount: 700, receiptNumber: "QR916", payerName: "Other payer" },
    })
    .mockResolvedValueOnce({ fields: { amount: 700 } })
    .mockResolvedValueOnce({
      fields: {
        amount: 700,
        receiptNumber: " qr 915 ",
        payerName: "Matching payer",
      },
    });
  await mount(
    <PaymentForm
      participant={{ _id: "person" }}
      year={2026}
      onClose={() => {}}
    />,
  );
  await chooseFile("A");
  const save = button("Төлемді сақтау");
  for (const text of ["different receipt", "no number"]) {
    await typeValue(textBox(), text);
    await act(async () => button("Мәтінді оқу").click());
    expect(document.body.textContent).toContain(
      "чек нөмірі бірдей болуы керек",
    );
    expect(field("Төленген сома, ₸ *").value).toBe("1600");
    expect(field("Чек нөмірі").value).toBe("QR915");
    expect(field("Төлеген адам").value).toBe("");
    expect(save.disabled).toBe(true);
    await act(async () => button("Мәтінді өшіру").click());
    expect(save.disabled).toBe(false);
  }
  await typeValue(textBox(), "same receipt");
  await act(async () => button("Мәтінді оқу").click());
  expect(field("Төлеген адам").value).toBe("Matching payer");
  expect(field("Төленген сома, ₸ *").value).toBe("1600");
  expect(save.disabled).toBe(false);
  await typeValue(field("Чек нөмірі"), "different");
  expect(save.disabled).toBe(true);
});

it("removes the accepted text and its OCR fields when a different file is selected", async () => {
  vi.mocked(send).mockResolvedValue({
    fields: { amount: 90000, receiptNumber: "TEXT-A", payerName: "Text payer" },
  });
  vi.mocked(api).mockResolvedValue({
    id: "B",
    status: "failed",
    error: "Unreadable B",
    fields: {},
  });
  await mount(
    <PaymentForm
      participant={{ _id: "person" }}
      year={2026}
      onClose={() => {}}
    />,
  );
  await typeValue(textBox(), "receipt text A");
  await act(async () => button("Мәтінді оқу").click());
  expect(field("Чек нөмірі").value).toBe("TEXT-A");
  expect(button("Төлемді сақтау").disabled).toBe(false);
  await typeValue(field("Төлеген адам"), "Corrected payer");
  await chooseFile("B");
  expect(textBox().value).toBe("");
  expect(field("Чек нөмірі").value).toBe("");
  expect(field("Төленген сома, ₸ *").value).toBe("");
  expect(field("Төлеген адам").value).toBe("Corrected payer");
  expect(button("Төлемді сақтау").disabled).toBe(true);
});

it("reopens a text-only payment, preserving its corrected payer while replacing the original text with file B", async () => {
  const before = {
    fields: { amount: 90000, receiptNumber: "TEXT-A", payerName: "Text payer" },
  };
  const replacement = {
    id: "B",
    status: "done",
    fields: {
      amount: 120000,
      receiptNumber: "FILE-B",
      payerName: "File payer",
    },
  };
  vi.mocked(api).mockImplementation(async (url) =>
    url === "/receipts/recognize-text" ? before : replacement,
  );
  await mount(
    <PaymentForm
      participant={{ _id: "person" }}
      year={2026}
      onClose={() => {}}
      payment={{
        _id: "payment",
        receiptText: "original text",
        amount: 90000,
        receiptNumber: "TEXT-A",
        payerName: "Corrected payer",
      }}
    />,
  );
  expect(textBox().value).toBe("original text");
  await chooseFile("B");
  expect(textBox().value).toBe("");
  expect(field("Чек нөмірі").value).toBe("FILE-B");
  expect(field("Төленген сома, ₸ *").value).toBe("1200");
  expect(field("Төлеген адам").value).toBe("Corrected payer");
  expect(button("Төлемді сақтау").disabled).toBe(false);
});

it.each(["identity", "receipt"] as const)(
  "clears only values from %s attachment A, blocks failed B, and accepts C without erasing a manual correction",
  async (kind) => {
    const isId = kind === "identity";
    const read = isId
      ? { documentNumber: "123456789", issuedBy: "МВД РК" }
      : { amount: 100000, receiptNumber: "A-91", payerName: "OCR payer" };
    const reread = isId
      ? { documentNumber: "987654321", issuedBy: "SECOND AUTHORITY" }
      : { amount: 200000, receiptNumber: "C-86", payerName: "Second payer" };
    const jobs = {
      A: { id: "A", status: "done", fields: read },
      B: { id: "B", status: "failed", fields: {}, error: "Unreadable B" },
      C: { id: "C", status: "done", fields: reread },
    };
    vi.mocked(api).mockImplementation(async (url, options) => {
      if (url === "/documents")
        return jobs[
          ((options!.body as FormData).get("file") as File)
            .name as keyof typeof jobs
        ];
      return jobs[url.split("/")[2] as keyof typeof jobs];
    });
    const manual = isId ? "ҚР ӘДІЛЕТ МИНИСТРЛІГІ" : "Corrected payer";
    await mount(
      isId ? (
        <ParticipantForm
          participant={{
            _id: "person",
            identityDocumentId: "A",
            documentNumber: "123456789",
            issuedBy: manual,
          }}
          onClose={() => {}}
        />
      ) : (
        <PaymentForm
          participant={{ _id: "person" }}
          payment={{
            _id: "pay",
            receiptDocumentId: "A",
            amount: 100000,
            payerName: manual,
            receiptNumber: "A-91",
          }}
          year={2026}
          onClose={() => {}}
        />
      ),
    );
    const number = field(isId ? "Куәлік нөмірі" : "Чек нөмірі");
    const corrected = field(isId ? "Кім берді" : "Төлеген адам");
    const save = button(isId ? "Қатысушыны сақтау" : "Төлемді сақтау");
    await vi.waitFor(() => expect(save.disabled).toBe(false));
    expect(number.value).toBe(isId ? "123456789" : "A-91");
    await chooseFile("B");
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Unreadable B"),
    );
    expect(number.value).toBe("");
    expect(corrected.value).toBe(manual);
    expect(save.disabled).toBe(true);
    await chooseFile("C");
    await vi.waitFor(() =>
      expect(number.value).toBe(isId ? "987654321" : "C-86"),
    );
    expect(corrected.value).toBe(manual);
    expect(save.disabled).toBe(false);
    expect(
      vi.mocked(api).mock.calls.every(([url]) => url.startsWith("/documents")),
    ).toBe(true);
  },
);

it("closes the previous participant's editor when browser history moves between cached profiles", async () => {
  const year = new Date().getFullYear();
  const profile = (id: string) => ({
    _id: id,
    firstName: id,
    payments: [],
    totalPaid: 0,
    remaining: 0,
    status: "unpaid",
  });
  for (const id of ["person-one", "person-two"])
    queryClient.setQueryData(["participant", id, year], profile(id));
  queryClient.setQueryData(["payment-categories"], { items: [] });
  function Back() {
    const navigate = useNavigate();
    return <button onClick={() => navigate(-1)}>History back</button>;
  }
  await mount(
    <MemoryRouter
      initialEntries={["/participants/person-one", "/participants/person-two"]}
    >
      <Back />
      <Routes>
        <Route path="/participants/:id" element={<ParticipantDetail />} />
      </Routes>
    </MemoryRouter>,
  );
  await act(async () => button("Өзгерту").click());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => button("History back").click());
  expect(document.querySelector("h1")?.textContent).toContain("person-one");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it("ignores a late result after cancellation and lets the next participant reopen the same receipt", async () => {
  const job = {
    id: "same",
    status: "done",
    fields: { amount: 160000, receiptNumber: "TEST-91" },
  };
  let finish!: (job: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  vi.mocked(api)
    .mockImplementationOnce(() => pending)
    .mockResolvedValue(job);
  function Example() {
    const [person, setPerson] = useState("first");
    return person ? (
      <PaymentForm
        participant={{ _id: person, firstName: person }}
        year={2026}
        onClose={() => setPerson("")}
      />
    ) : (
      <button onClick={() => setPerson("second")}>Second participant</button>
    );
  }
  await mount(<Example />);
  await chooseFile("same.pdf");
  await act(async () => button("Бас тарту").click());
  await act(async () => button("Second participant").click());
  await act(async () => finish(job));
  expect(field("Чек нөмірі").value).toBe("");
  await chooseFile("same.pdf");
  await vi.waitFor(() => expect(field("Чек нөмірі").value).toBe("TEST-91"));
  expect(field("Төленген сома, ₸ *").value).toBe("1600");
  expect(
    vi.mocked(api).mock.calls.every(([url]) => url.startsWith("/documents")),
  ).toBe(true);
});
