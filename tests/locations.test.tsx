import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocationSelect } from "../web/src/components/LocationSelect";
import { SETTLEMENTS, locationOptions } from "../shared/locations";
describe("Single settlement selector", () => {
  it("distinguishes duplicate settlement names by their district", () => {
    const options = locationOptions().filter(x => x.village === "Басқұдық");
    expect(options.map(x => x.region)).toEqual(["Маңғыстау ауданы", "Мұнайлы ауданы"]);
    expect(new Set(options.map(x => x.value)).size).toBe(2);
  });
  it("keeps the customer's city boundaries and all five district lists", () => {
    expect(SETTLEMENTS.Ақтау).toEqual(["Өмірзақ"]);
    expect(SETTLEMENTS.Жаңаөзен).toEqual(["Кендірлі", "Қызылсай", "Рахат", "Теңге"]);
    expect(SETTLEMENTS["Мұнайлы ауданы"]).toContain("Атамекен");
    expect(Object.values(SETTLEMENTS).reduce((n, items) => n + items.length, 0)).toBe(60);
  });
  it("shows a single select and preserves an existing address outside the directory", () => {
    const html = renderToStaticMarkup(<LocationSelect region="Ақтау" village="5 шағын аудан, 23 үй" onChange={() => {}} />);
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html).toContain("Елді мекен");
    expect(html).toContain("5 шағын аудан, 23 үй (сақталған мекенжай)");
    expect(html).toMatch(/<option[^>]*selected=""[^>]*>Ақтау қаласы · 5 шағын аудан/);
  });
});
