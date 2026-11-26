import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ParticipantForm } from "../web/src/components/forms";
import * as formHooks from "react-hook-form";
import * as uploadComponent from "../web/src/components/DocumentUpload";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MemberTable, ParticipantDetail } from "../web/src/Participants";
import { participantSchema } from "../shared/domain";
vi.mock("react-hook-form", { spy: true });
vi.mock("../web/src/components/DocumentUpload", { spy: true });
vi.mock("../web/src/components/common", async (original) => {
  const components = await original<typeof import("../web/src/components/common")>();
  return { ...components, Modal: ({children}: {children: React.ReactNode}) => <div>{children}</div> };
});

it("lets the user choose a document without showing the incomplete-profile banner", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ParticipantForm participant={{_id:"sample", firstName:"Сынақ"}} onClose={() => {}} />
    </QueryClientProvider>,
  );
  expect(html).toContain("Жеке куәлікті жүктеу");
  expect(html).not.toContain("Толық емес");
  expect(html).not.toContain("Белгісіз мәліметтерді бос қалдырып");
  client.clear();
});

it.each(["", "123456789012345678901234"])(
  "opens a legacy profile with clean identity fields before OCR resolves, including without an attachment",
  (attachment) => {
    const useForm = vi.mocked(formHooks.useForm).mockClear();
    const upload = vi.mocked(uploadComponent.DocumentUpload).mockClear();
    const client = new QueryClient();
    try {
      renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <ParticipantForm
            participant={{
              _id: "sample", firstName: "Үлгі", identityDocumentId: attachment,
              issuedBy: "123456789", issueDate: "2020-05-10", expiryDate: "2030-02-31",
            }}
            onClose={() => {}}
          />
        </QueryClientProvider>,
      );
      const form = useForm.mock.results[0].value;
      expect(form.getValues()).toMatchObject({
        firstName: "Үлгі", issuedBy: "", issueDate: "2020-05-10", expiryDate: "",
      });
      if (attachment) {
        const write = vi.spyOn(form, "setValue");
        upload.mock.calls[0][0].onFields({
          issuedBy: "ҚР ІШКІ ІСТЕР МИНИСТРЛІГІ", issueDate: "2020-05-11", expiryDate: "2030-05-09",
        }, true);
        expect(write.mock.calls.map(([key, value]) => [key, value])).toEqual([
          ["issuedBy", "ҚР ІШКІ ІСТЕР МИНИСТРЛІГІ"],
          ["expiryDate", "2030-05-09"],
        ]);
      }
    } finally {
      client.clear();
    }
  },
);

it.each([
  ["Жарамдылық мерзімі", "2030-02-31", "Көрсетілмеген", "Көрсетілмеген"],
  ["ҚР ІШКІ ІСТЕР МИНИСТРЛІГІ", "2030-05-09", "ҚР ІШКІ ІСТЕР МИНИСТРЛІГІ", "09.05.2030"],
])("shows the issuer and the validity range under the right labels", (issuedBy, expiryDate, issuerLabel, expiryLabel) => {
  vi.stubGlobal("location", { search: "?year=2026" });
  const client = new QueryClient();
  try {
    client.setQueryData(["participant", "sample", 2026], {
      ...participantSchema.parse({ firstName: "Үлгі" }),
      _id: "sample", issuedBy, issueDate: "2020-05-10", expiryDate,
      totalPaid: 0, remaining: 648700, overpayment: 0, status: "unpaid", payments: [],
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/participants/sample"]}>
          <Routes><Route path="/participants/:id" element={<ParticipantDetail />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html).toContain(`<dt>Кім берді</dt><dd>${issuerLabel}</dd>`);
    expect(html).toContain(`<dt>Жарамдылық мерзімі</dt><dd>10.05.2020 — ${expiryLabel}</dd>`);
  } finally {
    client.clear();
    vi.unstubAllGlobals();
  }
});
const render = (p: object) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <MemberTable
        year={2026}
        items={[
          {
            _id: "test",
            totalPaid: 0,
            remaining: 648700,
            status: "unpaid",
            ...p,
          },
        ]}
      />
    </MemoryRouter>,
  );
describe("Participant list completeness", () => {
  it("shows the incomplete badge and no invented age for missing birthday", () => {
    const html = render({
      ...participantSchema.parse({ firstName: "Айша" }),
      age: null,
      ageGroup: null,
    });
    expect(html).toContain("Толық емес");
    expect(html).toContain("Көрсетілмеген");
    expect(html).not.toContain("null жас");
    expect(html).not.toContain("66 жас және одан жоғары");
  });
  it("removes the badge for a completed profile", () => {
    const html = render({
      ...participantSchema.parse({
        lastName: "Сынақ",
        firstName: "Айша",
        birthDate: "1970-01-01",
        region: "Ақтау",
        phone: "+70000000001",
        iin: "000000000001",
        documentNumber: "TEST001",
        issuedBy: "Сынақ",
        issueDate: "2020-01-01",
        expiryDate: "2030-01-01",
      }),
      age: 56,
      ageGroup: 2,
    });
    expect(html).not.toContain("Толық емес");
    expect(html).toContain("56 жас");
  });
  it("shows the missing patronymic and the receipt recipient without replacing the participant name", () => {
    const html = render({lastName:"Үлгі", firstName:"Айша", middleName:"", lastRecipientName:"Сынақ алушы", lastReceiptType:"urshyk",lastPaymentAt:"2026-11-01T10:20"});
    expect(html).toContain("Әкесінің аты көрсетілмеген");
    expect(html).toContain("Соңғы төлемнің алушысы");
    expect(html).toContain("Сынақ алушы");
    expect(html).toContain("URSHYK");
    expect(html).toContain("Үлгі Айша");
  });

});
