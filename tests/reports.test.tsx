// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  REPORT_TITLES,
  reportFilename,
  type ReportType,
} from "../shared/report-names";
import { Reports } from "../web/src/OtherPages";

const downloads: string[] = [];
const requests: URL[] = [];
let root: Root;
let failCategories: boolean;
const categoryId = "abc123";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
beforeAll(() => notifyManager.setScheduler(queueMicrotask));
afterAll(() => notifyManager.setScheduler((fn) => setTimeout(fn, 0)));

beforeEach(async () => {
  failCategories = false;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", async (url: string) => {
    requests.push(new URL(url, "http://localhost"));
    if (url === "/api/payment-categories") {
      return failCategories
        ? Response.json({ message: "Service unavailable" }, { status: 503 })
        : Response.json({
            items: [{ _id: categoryId, name: "Көрме жарнасы", amount: 560000 }],
          });
    }
    return url.startsWith("/api/participants?")
      ? Response.json({ total: 2 })
      : new Response(new Blob(["workbook"]));
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:report");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Reports />
      </QueryClientProvider>,
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  queryClient.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  requests.length = 0;
  downloads.length = 0;
});

async function change(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function download(type: ReportType, year: number) {
  const button = [...document.querySelectorAll("button")].find(
    (el) => el.textContent?.trim() === REPORT_TITLES[type],
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
  expect(downloads.at(-1)).toBe(reportFilename(type, year));
  const url = requests
    .filter((r) => r.pathname.startsWith("/api/reports/"))
    .at(-1)!;
  expect(url.pathname).toBe("/api/reports/" + type);
  expect(url.searchParams.get("year")).toBe(String(year));
  return url.searchParams;
}

it("downloads five separately named workbooks and uses the city or district for the four lists while keeping the oblast report province-wide", async () => {
  const details = document.querySelector("details")!;
  expect(details.open).toBe(false);
  expect(requests.map((req) => req.pathname)).toEqual([
    "/api/payment-categories",
  ]);
  const primary = [...document.querySelectorAll("button")].filter(
    (button) => !details.contains(button),
  );
  expect(primary.map((button) => button.textContent?.trim())).toEqual([
    REPORT_TITLES["mangystau-oblast"],
    REPORT_TITLES["mangystau-district"],
    REPORT_TITLES.awards,
    REPORT_TITLES.urshyk,
    REPORT_TITLES.international,
  ]);
  await change(
    document.querySelector('select[aria-label="Есеп жылы"]')!,
    "2025",
  );
  const defaults = await download("mangystau-district", 2025);
  expect(Object.fromEntries(defaults)).toEqual({ year: "2025" });
  const kinds = document.querySelector<HTMLSelectElement>(
    ".district-payment-report select",
  )!;
  expect([...kinds.options].map((option) => option.text)).toEqual([
    "Барлық қосымша төлемдер",
    "Көрме жарнасы",
  ]);
  await change(kinds, categoryId);
  const cities = document.querySelector<HTMLSelectElement>(
    'section[aria-label="Аймақтық және атаулы тізімдер"] select',
  )!;
  expect(cities.options).toHaveLength(8);
  await change(cities, "Ақтау");
  for (const type of [
    "mangystau-oblast",
    "mangystau-district",
    "awards",
    "urshyk",
    "international",
  ] as const) {
    const params = await download(type, 2025);
    const expected: Record<string, string> = { year: "2025" };
    if (type !== "mangystau-oblast") expected.region = "Ақтау";
    if (type === "mangystau-district") expected.paymentCategoryId = categoryId;
    expect(Object.fromEntries(params)).toEqual(expected);
  }
  expect(new Set(downloads).size).toBe(5);
});

it("downloads the latest oblast workbook on each click for the same year", async () => {
  const year = Number(
    document.querySelector<HTMLSelectElement>('select[aria-label="Есеп жылы"]')!
      .value,
  );
  const path = `/api/reports/mangystau-oblast?year=${year}`;
  const fetchWorkbook = vi
    .fn()
    .mockResolvedValueOnce(new Response("first workbook"))
    .mockResolvedValueOnce(new Response("updated workbook"));
  vi.stubGlobal("fetch", fetchWorkbook);
  const createUrl = vi
    .mocked(URL.createObjectURL)
    .mockReturnValueOnce("blob:first")
    .mockReturnValueOnce("blob:updated");
  for (const version of ["first", "updated"]) {
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-describedby="oblast-content"]',
        )!
        .click(),
    );
    const blob = createUrl.mock.lastCall![0] as Blob;
    expect(await blob.text()).toBe(`${version} workbook`);
    expect(downloads.at(-1)).toBe(reportFilename("mangystau-oblast", year));
    expect(
      vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts.at(-1),
    ).toHaveProperty("href", `blob:${version}`);
  }
  expect(fetchWorkbook.mock.calls.map(([url]) => url)).toEqual([path, path]);
});

it("keeps all five previous exports in Басқа есептер and applies participant filters only to the two participant exports", async () => {
  await change(
    document.querySelector('select[aria-label="Есеп жылы"]')!,
    "2024",
  );
  const details = document.querySelector("details")!;
  expect(details.querySelector("summary")?.textContent).toBe("Басқа есептер");
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
  });
  const region = details.querySelector<HTMLSelectElement>("select")!;
  await change(region, "Жаңаөзен");
  expect(
    requests.some(
      (url) =>
        url.pathname === "/api/participants" &&
        url.searchParams.get("region") === "Жаңаөзен",
    ),
  ).toBe(true);
  for (const type of [
    "members",
    "payments",
    "income",
    "expense",
    "financial",
  ] as const) {
    const params = await download(type, 2024);
    if (type === "members" || type === "payments")
      expect(params.get("region")).toBe("Жаңаөзен");
    else expect(Object.fromEntries(params)).toEqual({ year: "2024" });
  }
});

it("can download every additional payment when categories are unavailable and retry the category list", async () => {
  const kinds = document.querySelector<HTMLSelectElement>(
    ".district-payment-report select",
  )!;
  await change(kinds, categoryId);
  failCategories = true;
  await act(async () => {
    await queryClient.resetQueries({ queryKey: ["payment-categories"] });
  });
  const error = document.querySelector('[role="alert"]')!;
  expect(error.textContent).toContain("Төлем түрлері жүктелмеді");
  expect(kinds.disabled).toBe(true);
  expect(kinds.value).toBe("");
  expect(kinds.options[0].text).toBe("Барлық қосымша төлемдер");
  const year = Number(
    document.querySelector<HTMLSelectElement>('select[aria-label="Есеп жылы"]')!
      .value,
  );
  expect(
    Object.fromEntries(await download("mangystau-district", year)),
  ).toEqual({ year: String(year) });
  failCategories = false;
  await act(async () => error.querySelector("button")!.click());
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(kinds.disabled).toBe(false);
  await change(kinds, categoryId);
  expect(
    (await download("mangystau-district", year)).get("paymentCategoryId"),
  ).toBe(categoryId);
});
