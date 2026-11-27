import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { money, participantSchema } from "../shared/domain";
import { ParticipantDetail } from "../web/src/Participants";

const additional = {
  paymentKind: "additional",
  paymentCategoryId: "registration",
  paymentCategoryName: "Тіркеу ақысы",
};
const payments = [
  { year: 2026, amount: 648700 },
  { ...additional, year: 2026, amount: 90000 },
  { ...additional, year: 2026, amount: 70000 },
  { ...additional, year: 2026, amount: 250000, voidedAt: "2026-01-05" },
  { ...additional, year: 2025, amount: 50000 },
  {
    ...additional,
    year: 2025,
    paymentCategoryId: undefined,
    paymentCategoryName: "Бұрынғы төлем",
    amount: 50000,
  },
].map((p, i) => ({ ...p, _id: String(i), paymentDate: `${p.year}-01-01` }));

function renderProfile(year: number) {
  vi.stubGlobal("location", { search: `?year=${year}` });
  const client = new QueryClient();
  client.setQueryData(["participant", "test", year], {
    _id: "test",
    ...participantSchema.parse({ firstName: "Сынақ" }),
    notes: "Қосымша 5000 теңге",
    totalPaid: year === 2026 ? 648700 : 0,
    remaining: year === 2026 ? 0 : 648700,
    status: year === 2026 ? "paid" : "unpaid",
    payments,
  });
  client.setQueryData(["payment-categories"], {
    items: [
      { _id: "registration", name: "Тіркеу ақысы", amount: 160000 },
      { _id: "other", name: "1600 теңге", amount: 160000 },
    ],
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/participants/test"]}>
        <Routes>
          <Route path="/participants/:id" element={<ParticipantDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  expect(html).toContain(`>${year} жылы төленген сомалар</h3>`);
  return html
    .split('aria-labelledby="paid-summary-title"')[1]
    .split("</section>")[0];
}

afterEach(() => vi.unstubAllGlobals());

it("shows actual dues, combined instalments and the annual total before any selection", () => {
  const summary = renderProfile(2026);
  expect(summary).toContain(`Мүшелік жарна</dt><dd>${money(648700)}`);
  expect(summary).toContain(`Тіркеу ақысы</dt><dd>${money(160000)}`);
  expect(summary).toContain(`Барлығы төленді</dt><dd>${money(808700)}`);
  expect(summary).not.toContain("1600 теңге");
  expect(summary).not.toContain("Бұрынғы төлем");
});

it("distinguishes paid categories with equal amounts, including historical names without IDs", () => {
  const summary = renderProfile(2025);
  expect(summary).toContain(`Тіркеу ақысы</dt><dd>${money(50000)}`);
  expect(summary).toContain(`Бұрынғы төлем</dt><dd>${money(50000)}`);
  expect(summary).toContain(`Барлығы төленді</dt><dd>${money(100000)}`);
});

it("shows a zero total when only notes and catalogue entries are available for the year", () => {
  const summary = renderProfile(2024);
  expect(summary).toContain("Қосымша төлем тіркелмеген");
  expect(summary).toContain(`Барлығы төленді</dt><dd>${money(0)}`);
});
