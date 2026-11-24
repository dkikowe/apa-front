// Membership location directory supplied by the customer (November 2026).
// Stable region keys preserve existing records and filters.
export const REGION_LABELS: Record<string, string> = {
  Ақтау: "Ақтау қаласы",
  Жаңаөзен: "Жаңаөзен қаласы",
  "Бейнеу ауданы": "Маңғыстау облысы, Бейнеу ауданы",
  "Қарақия ауданы": "Маңғыстау облысы, Қарақия ауданы",
  "Маңғыстау ауданы": "Маңғыстау облысы, Маңғыстау ауданы",
  "Мұнайлы ауданы": "Маңғыстау облысы, Мұнайлы ауданы",
  "Түпқараған ауданы": "Маңғыстау облысы, Түпқараған ауданы",
};
export const SETTLEMENTS: Record<string, readonly string[]> = {
  Ақтау: ["Өмірзақ"],
  Жаңаөзен: ["Кендірлі", "Қызылсай", "Рахат", "Теңге"],
  "Бейнеу ауданы": [
    "Ақжігіт",
    "Бейнеу",
    "Боранқұл",
    "Есет",
    "Ноғайты",
    "Сам",
    "Сарға",
    "Сыңғырлау",
    "Тәжен",
    "Төлеп",
    "Тұрыш",
  ],
  "Қарақия ауданы": [
    "Аққұдық",
    "Болашақ",
    "Бопай",
    "Бостан",
    "Жетібай",
    "Мұнайшы",
    "Құрық",
    "Құланды",
    "Сенек",
  ],
  "Маңғыстау ауданы": [
    "№15 бекет",
    "Ақшымырау",
    "Басқұдық",
    "Бекі",
    "Боздақ",
    "Жарма",
    "Жармыш",
    "Жыңғылды",
    "Қияқты",
    "Қызан",
    "Оңды",
    "Сазды",
    "Сайөтес",
    "Тасмұрын",
    "Тиген",
    "Тұщыбек",
    "Тұщықұдық",
    "Ұштаған",
    "Шайыр",
    "Шебір",
    "Шетпе",
  ],
  "Мұнайлы ауданы": [
    "Атамекен",
    "Басқұдық",
    "Батыр",
    "Баянды",
    "Бірлік",
    "Дәулет",
    "Қызылтөбе",
    "Маңғыстау",
  ],
  "Түпқараған ауданы": [
    "Ақшұқыр",
    "Баутин",
    "Қызылөзен",
    "Сайын Шапағатов",
    "Таушық",
    "Форт Шевченко қаласы",
  ],
};
export const regionLabel = (region?: string) =>
  region ? REGION_LABELS[region] || region : "";
export function locationLabel(region?: string, settlement?: string) {
  return [regionLabel(region), settlement].filter(Boolean).join(" · ");
}
export function locationOptions() {
  return Object.keys(SETTLEMENTS).flatMap((region) =>
    ["", ...SETTLEMENTS[region]].map((village) => ({
      value: JSON.stringify([region, village]),
      region,
      village,
      label: village
        ? locationLabel(region, village)
        : region.endsWith("ауданы")
          ? `${regionLabel(region)} · Елді мекен көрсетілмеген`
          : regionLabel(region),
    })),
  );
}
