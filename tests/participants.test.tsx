import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MemberTable } from "../web/src/Participants";
import { participantSchema } from "../shared/domain";
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
