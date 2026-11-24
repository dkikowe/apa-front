import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { api, queryClient, qs } from "./api";
import { money } from "../../shared/domain";
import { Button } from "./components/ui/button";
import {
  PageHeading,
  YearSelect,
  defaultFilters,
  Filters,
  Loading,
  ErrorBox,
  Empty,
  Pagination,
  Confirm,
  ExportButton,
} from "./components/common";
import { FinanceForm } from "./components/forms";
export function FinancePage() {
  const [year, setYear] = useState(defaultFilters.year),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<any>(null),
    [removing, setRemoving] = useState<any>(null);
  const query = useQuery({
    queryKey: ["finance", year, page],
    queryFn: () => api("/finance?" + qs({ year, page })),
  });
  const stats = useQuery({
    queryKey: ["statistics", { year }],
    queryFn: () => api(`/statistics?year=${year}`),
  });
  const data = stats.data?.finance;
  return (
    <>
      <PageHeading
        eyebrow="ҰЙЫМНЫҢ ҚАРЖЫСЫ"
        title="Қаржы"
        description="Түскен және жұмсалған ақшаның есебін жүргізіңіз."
      >
        <YearSelect
          value={year}
          onChange={(v) => {
            setYear(v);
            setPage(1);
          }}
        />
        <Button onClick={() => setEditing({ new: true })}>
          <Plus size={20} />
          Кіріс / шығыс қосу
        </Button>
      </PageHeading>
      {stats.isError ? (
        <ErrorBox error={stats.error} />
      ) : data ? (
        <>
          <div className="stats-grid finance-stats">
            {[
              { label: "Мүшелік жарналар", value: data.membership },
              { label: "Өзге кірістер", value: data.income },
              { label: "Жалпы кіріс", value: data.totalIncome },
              { label: "Жалпы шығыс", value: data.expense },
              { label: "Есептік қалдық", value: data.balance },
            ].map((x) => (
              <div className="stat-card" key={x.label}>
                <span>{x.label}</span>
                <strong>{money(x.value)}</strong>
              </div>
            ))}
          </div>
          <p className="small-note">
            Сомалар ақша түскен немесе жұмсалған жыл бойынша есептеледі. Есептік
            қалдық — енгізілген жазбалардың айырмасы, банктегі нақты қалдық
            емес.
          </p>
        </>
      ) : (
        <Loading />
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Өзге кірістер мен шығыстар</h2>
            <p>Мүшелік жарналар бөлек есептеледі</p>
          </div>
          <ExportButton type="financial" filters={{ year }} />
        </div>
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} />
        ) : query.data?.items.length ? (
          <>
            <div className="table-scroll">
              <table role="table" className="record-table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">
                      Күні
                    </th>
                    <th scope="col" role="columnheader">
                      Түрі
                    </th>
                    <th scope="col" role="columnheader">
                      Санаты / түсініктеме
                    </th>
                    <th scope="col" role="columnheader" className="numeric">
                      Сома
                    </th>
                    <th scope="col" role="columnheader">
                      Әрекеттер
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {query.data.items.map((t: any) => (
                    <tr role="row" key={t._id}>
                      <td role="cell" data-label="Күні">
                        {t.date}
                      </td>
                      <td role="cell" data-label="Түрі">
                        <span className={`transaction-type ${t.type}`}>
                          {t.type === "income" ? (
                            <ArrowDownLeft size={17} />
                          ) : (
                            <ArrowUpRight size={17} />
                          )}{" "}
                          {t.type === "income" ? "Кіріс" : "Шығыс"}
                        </span>
                      </td>
                      <td role="cell" data-label="Санаты / түсініктеме">
                        <strong>{t.category}</strong>
                        <small>{t.description}</small>
                      </td>
                      <td
                        role="cell"
                        className="numeric strong"
                        data-label="Сома"
                      >
                        {money(t.amount)}
                      </td>
                      <td role="cell" data-label="Әрекеттер">
                        <div className="row-actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(t)}
                          >
                            Өзгерту
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRemoving(t)}
                          >
                            Жою
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={query.data.total}
              page={page}
              onChange={setPage}
            />
          </>
        ) : (
          <Empty
            title="Кіріс немесе шығыс әлі енгізілмеген"
            description="Мысалы, жалдау ақысын немесе кеңсе шығынын қосыңыз."
          />
        )}
      </section>
      {editing && (
        <FinanceForm
          transaction={editing.new ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <Confirm
          title="Жазбаны жою керек пе?"
          description={`${removing.category} · ${money(removing.amount)}. Қаржы есебі қайта есептеледі.`}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api(`/finance/${removing._id}`, { method: "DELETE" });
            await queryClient.invalidateQueries();
            toast.success("Жазба жойылды");
          }}
        />
      )}
    </>
  );
}
export function Reports() {
  const [filters, setFilters] = useState(defaultFilters);
  const query = useQuery({
    queryKey: ["report-count", filters],
    queryFn: () => api("/participants?" + qs({ ...filters, limit: 1 })),
  });
  return (
    <>
      <PageHeading
        eyebrow="ДАЙЫН ҚҰЖАТТАР"
        title="Есептер"
        description="Керек тізімді таңдап, Excel файлын жүктеңіз."
      />
      <section className="panel reports-filter">
        <div className="panel-heading">
          <div>
            <h2>1. Кімдер есепке кірсін?</h2>
            <p>Бірнеше шартты қатар таңдауға болады</p>
          </div>
        </div>
        <Filters value={filters} onChange={setFilters} />
        {query.isError ? (
          <ErrorBox error={query.error} />
        ) : (
          <p className="match-count">
            {query.isLoading
              ? "Есептелуде…"
              : `${query.data?.total || 0} қатысушы таңдалды`}
          </p>
        )}
      </section>
      <h2 className="report-step">2. Қажетті есепті жүктеңіз</h2>
      <div className="report-grid">
        {[
          {
            type: "members",
            title: "Қатысушылар тізімі",
            text: "Аты-жөні, аймағы, жасы және жарнасының жағдайы.",
            filtered: true,
          },
          {
            type: "payments",
            title: "Мүшелік жарна төлемдері",
            text: "Таңдалған жылға тіркелген төлемдер мен чектер.",
            filtered: true,
          },
          {
            type: "income",
            title: "Барлық кірістер",
            text: "Мүшелік жарналар мен өзге түсімдер. Тек жыл бойынша.",
            filtered: false,
          },
          {
            type: "expense",
            title: "Шығыстар",
            text: "Ұйымның барлық шығыстары. Тек жыл бойынша.",
            filtered: false,
          },
          {
            type: "financial",
            title: "Жалпы қаржы есебі",
            text: "Кірістер, шығыстар және есептік қалдық. Тек жыл бойынша.",
            filtered: false,
          },
        ].map((report) => (
          <section className="panel report-card" key={report.type}>
            <span className="report-icon">
              <FileSpreadsheet size={26} />
            </span>
            <h3>{report.title}</h3>
            <p>{report.text}</p>
            <small>
              {report.filtered
                ? "Жоғарыдағы барлық іріктеу шарты қолданылады."
                : "Аймақ, жас және төлем жағдайы қолданылмайды."}
            </small>
            <ExportButton
              type={report.type}
              filters={report.filtered ? filters : { year: filters.year }}
              label="Excel файлын жүктеу"
            />
          </section>
        ))}
      </div>
      <div className="notice-strip">
        <BookOpen size={22} />
        <span>
          Төлегендерді немесе төлемегендерді алу үшін «Төлем жағдайы» шартын
          таңдаңыз. Есепке барлық сәйкес жазба кіреді.
        </span>
      </div>
    </>
  );
}
export function Settings() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings"),
  });
  return (
    <>
      <PageHeading
        eyebrow="ЖҮЙЕ ТУРАЛЫ"
        title="Баптаулар"
        description="Есеп жүргізудің негізгі шарттары."
      />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} />
      ) : (
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div>
              <h2>Мүшелік жарна</h2>
              <p>Әр қатысушыға бір күнтізбелік жылға</p>
            </div>
            <span className="settings-fee">{money(query.data.annualFee)}</span>
          </div>
          <div className="settings-row">
            <strong>Жарнаны бөліп төлеу</strong>
            <span>Болады. Әр төлемді бөлек қосыңыз.</span>
          </div>
          <div className="settings-row">
            <strong>Жаңа жылдағы есеп</strong>
            <span>Әр жыл бөлек. Ескі төлемдер сақталады.</span>
          </div>
          <div className="settings-row">
            <strong>Артық төленген ақша</strong>
            <span>Көрсетіледі, келесі жылға автоматты көшірілмейді.</span>
          </div>
          <div className="settings-row">
            <strong>Құжатты тану тілдері</strong>
            <span>Қазақша, орысша және ағылшынша</span>
          </div>
          <div className="settings-row">
            <strong>Уақыт белдеуі</strong>
            <span>Қазақстан, Алматы уақыты</span>
          </div>
        </section>
      )}
      <section className="panel settings-help">
        <ShieldCheck size={30} />
        <div>
          <h2>Мәліметтерге тек әкімші кіре алады</h2>
          <p>
            Жұмысты аяқтағанда сол жақтағы «Шығу» батырмасын басыңыз. Құпиясөзді
            ауыстыру немесе жылдық жарнаны өзгерту қажет болса, жүйеге жауапты
            маманға хабарласыңыз.
          </p>
        </div>
      </section>
    </>
  );
}
