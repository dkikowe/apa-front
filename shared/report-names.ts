export const REPORT_TITLES = {
  "mangystau-oblast": "Маңғыстау облысының тіркеу және кіріс есебі",
  "mangystau-district": "Маңғыстау облысының аймақтық тізімі",
  awards: "Марапат қағаздарын толтыруға арналған тізім",
  urshyk: "Республикалық «Ұршық» бірлестігінің есебі",
  international: "Шетелге арналған тізім",
  members: "Қатысушылар тізімі",
  payments: "Қатысушылардың төлемдері",
  income: "Кірістер есебі",
  expense: "Шығыстар есебі",
  financial: "Жалпы қаржы есебі",
} as const;

export type ReportType = keyof typeof REPORT_TITLES;

export function reportFilename(type: ReportType, year: number | string) {
  return `${REPORT_TITLES[type]} — ${year}.xlsx`;
}
