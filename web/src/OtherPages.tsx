import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowDownLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, queryClient, qs } from "./api";
import { money, REGIONS } from "../../shared/domain";
import { regionLabel } from "../../shared/locations";
import { REPORT_TITLES } from "../../shared/report-names";
import { Button } from "./components/ui/button";
import {
  PageHeading,
  YearSelect,
  defaultFilters,
  Filters,
  Field,
  Loading,
  ErrorBox,
  Empty,
  Pagination,
  Confirm,
  ExportButton,
} from "./components/common";
import { FinanceForm } from "./components/forms";
import { usePaymentCategories } from "./components/PaymentCategorySelect";
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
              { label: "Қосымша төлемдер", value: data.additional || 0 },
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
            <p>Қатысушылардың төлемдері бөлек есептеледі</p>
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
  const [year, setYear] = useState(defaultFilters.year);
  const [district, setDistrict] = useState("");
  const [paymentCategoryId, setPaymentCategoryId] = useState("");
  const categories = usePaymentCategories();
  const selectedCategory = categories.data?.items.find(
    (category) => category._id === paymentCategoryId,
  );
  const [showOther, setShowOther] = useState(false);
  const rosterFilters = { year, region: district };
  return (
    <>
      <PageHeading
        title="Есептер"
        description="Жылды таңдап, керекті Excel файлын жүктеңіз."
      >
        <YearSelect value={year} onChange={setYear} />
      </PageHeading>
      <section
        className="panel report-choices"
        aria-labelledby="mangystau-reports"
      >
        <h2 id="mangystau-reports">Маңғыстау облысы</h2>
        <div className="report-option">
          <ExportButton
            type="mangystau-oblast"
            filters={{ year }}
            label={REPORT_TITLES["mangystau-oblast"]}
            descriptionId="oblast-content"
          />
          <p id="oblast-content">
            Есептің басында мүшелік жарнаға және әр қосымша төлем түріне түскен
            сома көрсетіледі. «Қатысушылар» парағында аты-жөні, туған күні мен
            телефоны, «Төлемдер» парағында әр төлемнің күні мен уақыты бар.
          </p>
        </div>
      </section>
      <section
        className="panel report-choices"
        aria-label="Аймақтық және атаулы тізімдер"
      >
        <Field label="Аймақтық және атаулы тізімдерге кіретін қала немесе аудан">
          <select
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
          >
            <option value="">Барлық қала мен аудан</option>
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {regionLabel(region)}
              </option>
            ))}
          </select>
        </Field>
        <div className="district-payment-report">
          <Field
            label="Аймақтық тізімдегі төлем түрі"
            hint="5 600 ₸ төлемі бөлек тіркелсе, оның атауын таңдаңыз."
          >
            <select
              value={selectedCategory?._id || ""}
              onChange={(event) => setPaymentCategoryId(event.target.value)}
              disabled={!categories.data?.items.length}
            >
              <option value="">Барлық қосымша төлемдер</option>
              {categories.data?.items.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          {categories.isError && (
            <div className="report-category-error" role="alert">
              <p>
                Төлем түрлері жүктелмеді. Барлық қосымша төлемдер бойынша
                тізімді жүктей аласыз.
              </p>
              <Button
                variant="outline"
                onClick={() => void categories.refetch()}
                disabled={categories.isFetching}
              >
                Төлем түрлерін қайта жүктеу
              </Button>
            </div>
          )}
          <ExportButton
            type="mangystau-district"
            filters={{
              ...rosterFilters,
              paymentCategoryId: selectedCategory?._id,
            }}
            label={REPORT_TITLES["mangystau-district"]}
          />
        </div>
        <ExportButton
          type="awards"
          filters={rosterFilters}
          label={REPORT_TITLES.awards}
        />
        <div className="report-option">
          <ExportButton
            type="urshyk"
            filters={rosterFilters}
            label={REPORT_TITLES.urshyk}
            descriptionId="urshyk-content"
          />
          <p id="urshyk-content">
            Ұршыққа жіберілетін қатысушылардың құжаттағы деректері.
          </p>
        </div>
        <div className="report-option">
          <ExportButton
            type="international"
            filters={rosterFilters}
            label={REPORT_TITLES.international}
            descriptionId="international-content"
          />
          <p id="international-content">
            Қатысушының аты-жөні, туған күні және жеке куәлік деректері.
            «Жынысы» бағанында барлығына «Әйел» деп жазылады.
          </p>
        </div>
      </section>
      <details
        className="panel other-reports"
        onToggle={(event) => setShowOther(event.currentTarget.open)}
      >
        <summary>Басқа есептер</summary>
        <OtherReports year={year} open={showOther} />
      </details>
    </>
  );
}

function OtherReports({ year, open }: { year: number; open: boolean }) {
  const [criteria, setCriteria] = useState(defaultFilters);
  const filters = { ...criteria, year };
  const query = useQuery({
    enabled: open,
    queryKey: ["report-count", filters],
    queryFn: () => api("/participants?" + qs({ ...filters, limit: 1 })),
  });
  return (
    <>
      <section className="report-choices" aria-labelledby="member-reports">
        <h3 id="member-reports">Қатысушылар мен төлемдер</h3>
        <Filters year={false} value={filters} onChange={setCriteria} />
        {query.isError ? (
          <ErrorBox error={query.error} />
        ) : (
          <p className="report-match" role="status">
            {query.isLoading
              ? "Есептелуде…"
              : `${query.data?.total || 0} қатысушы таңдалды`}
          </p>
        )}
        <ExportButton
          type="members"
          filters={filters}
          label={REPORT_TITLES.members}
        />
        <ExportButton
          type="payments"
          filters={filters}
          label={REPORT_TITLES.payments}
        />
      </section>
      <section className="report-choices" aria-labelledby="finance-reports">
        <h3 id="finance-reports">{year} жылғы қаржы</h3>
        {(["income", "expense", "financial"] as const).map((type) => (
          <ExportButton
            key={type}
            type={type}
            filters={{ year }}
            label={REPORT_TITLES[type]}
          />
        ))}
      </section>
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
