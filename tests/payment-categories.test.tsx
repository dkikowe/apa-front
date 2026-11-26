import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentCategorySelect } from "../web/src/components/PaymentCategorySelect";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ParticipantDetail } from "../web/src/Participants";
import { PaymentForm } from "../web/src/components/forms";
import { participantSchema } from "../shared/domain";
import { paymentCategoryLabel } from "../shared/domain";

vi.mock("../web/src/components/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../web/src/components/common")>();
  return { ...actual, Modal: ({ children, description }: any) => <div role="dialog"><p>{description}</p>{children}</div> };
});
afterEach(() => vi.unstubAllGlobals());
describe("Shared additional payment selector", () => {
  function render(value = "") {
    const client = new QueryClient();
    client.setQueryData(["payment-categories"], { items: [
      { _id: "category-one", name: "Көрмеге қатысу", amount: 500000 },
      { _id: "category-two", name: "Сапар", amount: 150000 },
    ] });
    const html = renderToStaticMarkup(<QueryClientProvider client={client}>
      <PaymentCategorySelect value={value} disabled={false} onChange={() => {}} onEditing={() => {}} onBusy={() => {}} />
    </QueryClientProvider>);
    client.clear();
    return html;
  }
  it("offers additional categories and a labelled plus action outside the membership flow", () => {
    const html = render();
    expect(html).toMatch(/<option value="" selected="">Төлемді таңдаңыз/);
    expect(html).not.toContain("<option value=\"\" selected=\"\">Мүшелік жарна");
    expect(html).toContain("Көрмеге қатысу");
    expect(html).toContain("Сапар");
    expect(html).toContain("Жаңа түр қосу");
  });
  it("retains the selected additional category and explains its separate accounting", () => {
    const html = render("category-two");
    expect(html).toMatch(/<option value="category-two" selected="">Сапар/);
    expect(html).toContain("мүшелік жарнадан бөлек есептеледі");
  });
  it("labels legacy payments as membership and additional payments with their saved name", () => {
    expect(paymentCategoryLabel({})).toBe("Мүшелік жарна");
    expect(paymentCategoryLabel({paymentKind:"additional",paymentCategoryName:"Көрмеге қатысу"})).toBe("Көрмеге қатысу");
  });
});


describe("Payment cards on the participant page", () => {
  it("renders a separate new payment card directly below membership without opening a popup", () => {
    vi.stubGlobal("location", {search:"?year=2026"});
    const client = new QueryClient();
    client.setQueryData(["participant", "person", 2026], { _id:"person", ...participantSchema.parse({firstName:"Сынақ"}), totalPaid:0, remaining:648700, overpayment:0, status:"unpaid", age:null, payments:[] });
    client.setQueryData(["payment-categories"], {items:[]});
    const html=renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/participants/person"]}><Routes><Route path="/participants/:id" element={<ParticipantDetail />} /></Routes></MemoryRouter></QueryClientProvider>);
    const membership=html.indexOf("<h2>Мүшелік жарна</h2>"), additional=html.indexOf("<h2>Жаңа төлем</h2>"), history=html.indexOf("<h2>Төлем тарихы</h2>");
    expect(membership).toBeGreaterThan(-1);expect(additional).toBeGreaterThan(membership);expect(history).toBeGreaterThan(additional);
    expect(html.slice(additional,history)).toContain("Төлемді таңдаңыз");
    expect(html.slice(additional,history)).toContain("Жаңа түр қосу");
    expect(html).not.toContain('role="dialog"');
    client.clear();
  });
  it("opens the payment form with the chosen category and editable default amount, without category creation controls", () => {
    const client = new QueryClient();
    const html=renderToStaticMarkup(<QueryClientProvider client={client}><PaymentForm participant={{firstName:"Сынақ",lastName:"Үлгі"}} year={2026} initialCategory={{_id:"012345678901234567890123",name:"Көрме",amount:500000}} onClose={()=>{}} /></QueryClientProvider>);
    expect(html).toContain("Көрме");expect(html).toMatch(/<input[^>]*inputMode="decimal"[^>]*value="5000"/);
    expect(html).not.toContain("Жаңа түр қосу");expect(html).not.toContain("Төлемді таңдаңыз");
    expect(html).not.toContain('readOnly=""');
    client.clear();
  });
  it("keeps the membership form independent of the selected additional category", () => {
    const client = new QueryClient();
    const html=renderToStaticMarkup(<QueryClientProvider client={client}><PaymentForm participant={{firstName:"Сынақ",lastName:"Үлгі"}} year={2026} onClose={()=>{}} /></QueryClientProvider>);
    expect(html).toContain("Мүшелік жарна");expect(html).not.toContain("Жаңа түр қосу");
    client.clear();
  });
});
