import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentCategorySelect } from "../web/src/components/PaymentCategorySelect";
import { paymentCategoryLabel } from "../shared/domain";

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
  it("always includes membership and offers all shared categories and a labelled plus action", () => {
    const html = render();
    expect(html).toMatch(/<option value="" selected="">Мүшелік жарна/);
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
