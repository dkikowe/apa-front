import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Upload,
  Search,
  ArrowUpRight,
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  Phone,
  MapPin,
  CalendarDays,
  Wallet,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { sortPayments } from "../../shared/payment-order";
import { regionLabel, locationLabel } from "../../shared/locations";
import { api, qs, send, queryClient } from "./api";
import {
  money,
  AGE_LABELS,
  FEE,
  IDENTITY_FIELDS,
  validityPeriod,
  missingParticipantFields,
} from "../../shared/domain";
import { Button } from "./components/ui/button";
import {
  defaultFilters,
  type FilterState,
  PageHeading,
  Filters,
  Loading,
  ErrorBox,
  Status,
  Empty,
  Pagination,
  ExportButton,
  Confirm,
  YearSelect,
  Modal,
} from "./components/common";
import { DocumentButton } from "./components/DocumentButton";
import { ExcelImport } from "./components/ExcelImport";
import { ParticipantForm, PaymentForm } from "./components/forms";
export function useDebounce<T>(value: T, ms = 300) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return result;
}
export function MemberTable({
  items,
  year,
  compact = false,
  offset = 0,
}: {
  items: any[];
  year: number;
  compact?: boolean;
  offset?: number;
}) {
  return (
    <div className="table-scroll">
      <table role="table" className="record-table members-table">
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              Қатысушы
            </th>
            <th scope="col" role="columnheader">
              Елді мекен
            </th>
            {!compact && (
              <>
                <th scope="col" role="columnheader" className="member-extra">
                  Жасы / туған күні
                </th>
                <th scope="col" role="columnheader" className="member-extra">
                  Телефон
                </th>
              </>
            )}
            <th scope="col" role="columnheader" className="numeric">
              Төленді
            </th>
            <th scope="col" role="columnheader" className="numeric">
              Қалды
            </th>
            <th scope="col" role="columnheader">
              Төлем жағдайы
            </th>
            <th scope="col" role="columnheader">
              <span className="sr-only">Қарау</span>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {items.map((p: any, i: number) => (
            <tr role="row" key={p._id}>
              <td role="cell" className="member-primary">
                <Link
                  className="member-name"
                  to={`/participants/${p._id}?year=${year}`}
                >
                  <span className={`avatar avatar-${i % 4}`}>
                    {p.lastName?.[0]}
                    {p.firstName?.[0]}
                  </span>
                  <span>
                    <strong>
                      {!compact && `${offset + i + 1}. `}
                      {[p.lastName, p.firstName].filter(Boolean).join(" ") ||
                        "Аты-жөні көрсетілмеген"}
                    </strong>
                    <small>{p.middleName || "Қатысушы"}</small>
                    {missingParticipantFields(p).length > 0 && (
                      <span className="incomplete-badge">Толық емес</span>
                    )}
                  </span>
                </Link>
              </td>
              <td role="cell" data-label="Елді мекен">
                {regionLabel(p.region) || "Көрсетілмеген"}
                {p.village && <small className="table-sub">{p.village}</small>}
              </td>
              {!compact && (
                <>
                  <td
                    role="cell"
                    className="member-extra"
                    data-label="Жасы / туған күні"
                  >
                    {p.age == null ? "Көрсетілмеген" : `${p.age} жас`}
                    <small>
                      {p.birthDate}
                      <br />
                      {AGE_LABELS[p.ageGroup]}
                    </small>
                  </td>
                  <td role="cell" className="member-extra" data-label="Телефон">
                    {p.phone || "Көрсетілмеген"}
                  </td>
                </>
              )}
              <td role="cell" className="numeric strong" data-label="Төленді">
                {money(p.totalPaid)}
                {p.lastPaymentAt && (
                  <small>
                    Соңғы төлем:{" "}
                    {p.lastPaymentAt
                      .slice(0, 10)
                      .split("-")
                      .reverse()
                      .join(".")}{" "}
                    {p.lastPaymentAt.slice(11) || "(уақыты жоқ)"}
                  </small>
                )}
                {p.overpayment > 0 && (
                  <small>Артық: {money(p.overpayment)}</small>
                )}
              </td>
              <td role="cell" className="numeric" data-label="Қалды">
                {money(p.remaining)}
              </td>
              <td role="cell" data-label="Төлем жағдайы">
                <Status status={p.status} />
              </td>
              <td role="cell">
                <Link
                  className="row-open"
                  aria-label={`${p.lastName} ${p.firstName}: карточканы ашу`}
                  to={`/participants/${p._id}?year=${year}`}
                >
                  <span>Қарау</span>
                  <ArrowUpRight size={20} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Participants({ membership = false }: { membership?: boolean }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterState>(defaultFilters),
    [page, setPage] = useState(1),
    [adding, setAdding] = useState(false),
    [importing, setImporting] = useState(false),
    [showFilters, setShowFilters] = useState(true);
  const search = useDebounce(filters.q);
  const query = useQuery({
    queryKey: ["members", { ...filters, q: search, page }],
    queryFn: () => api("/participants?" + qs({ ...filters, q: search, page })),
  });
  const update = (f: FilterState) => {
    setFilters(f);
    setPage(1);
  };
  return (
    <>
      {importing && <ExcelImport onClose={() => setImporting(false)} />}
      <PageHeading
        eyebrow="ҚАТЫСУШЫЛАР ЕСЕБІ"
        title={membership ? "Мүшелік жарналар" : "Қатысушылар"}
        description={
          membership
            ? "Кім төледі, кімнің қанша төлеуі қалды — бәрі осында."
            : "Әр қатысушының мәліметі мен төлемі бір жерде."
        }
      >
        <Button variant="outline" onClick={() => setImporting(true)}>
          <Upload size={22} />
          Excel-ден қосу
        </Button>
        <ExportButton filters={filters} />
        <Button onClick={() => setAdding(true)}>
          <Plus size={20} />
          Қатысушы қосу
        </Button>
      </PageHeading>
      {membership && (
        <div className="notice-strip">
          <Wallet size={22} />
          <span>
            Бір жылға мүшелік жарна — <strong>{money(FEE)}</strong>. Төлем қосу
            үшін қатысушының атына басыңыз.
          </span>
        </div>
      )}
      <section className="panel">
        <div className="list-toolbar">
          <div className="search-input">
            <Search size={20} />
            <input
              aria-label="Қатысушыны іздеу"
              placeholder="Аты-жөні немесе телефоны бойынша іздеу"
              value={filters.q}
              onChange={(e) => update({ ...filters, q: e.target.value })}
            />
          </div>
          <YearSelect
            value={filters.year}
            onChange={(year) => update({ ...filters, year })}
          />
          <Button
            variant="outline"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={18} />
            {showFilters ? "Сүзгілерді жасыру" : "Сүзгілерді көрсету"}
          </Button>
        </div>
        {showFilters && (
          <div className="filter-section">
            <Filters year={false} value={filters} onChange={update} />
            <div className="extra-filters">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={filters.archived === "true"}
                  onChange={(e) =>
                    update({ ...filters, archived: String(e.target.checked) })
                  }
                />
                Мұрағаттағы қатысушылар
              </label>
              <label className="sort-field">
                Реті{" "}
                <select
                  value={filters.sort}
                  onChange={(e) =>
                    update({
                      ...filters,
                      sort: e.target.value,
                      direction:
                        e.target.value === "paymentTime"
                          ? "desc"
                          : filters.direction,
                    })
                  }
                >
                  <option value="name">Аты-жөні бойынша</option>
                  <option value="age">Жасы бойынша</option>
                  <option value="paid">Төленген сомасы бойынша</option>
                  <option value="paymentTime">
                    Соңғы төлем күні мен уақыты бойынша
                  </option>
                </select>
              </label>
              <select
                aria-label="Сұрыптау бағыты"
                value={filters.direction}
                onChange={(e) =>
                  update({ ...filters, direction: e.target.value })
                }
              >
                <option value="asc">
                  {filters.sort === "paymentTime"
                    ? "Ескі төлемдер алдымен"
                    : "Өсу ретімен"}
                </option>
                <option value="desc">
                  {filters.sort === "paymentTime"
                    ? "Жаңа төлемдер алдымен"
                    : "Кему ретімен"}
                </option>
              </select>
            </div>
          </div>
        )}
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorBox error={query.error} retry={() => void query.refetch()} />
        ) : query.data?.items.length ? (
          <>
            <MemberTable
              items={query.data.items}
              year={filters.year}
              offset={(page - 1) * 20}
            />
            <Pagination
              page={page}
              total={query.data.total}
              onChange={setPage}
            />
          </>
        ) : (
          <Empty
            title={
              filters.q || filters.region || filters.age || filters.status
                ? "Қатысушы табылмады"
                : "Қатысушылар тізімі әзірге бос"
            }
            description="Іздеу шарттарын өзгертіңіз немесе жаңа қатысушы қосыңыз."
          >
            <Button onClick={() => setAdding(true)}>
              <Plus size={18} />
              Қатысушы қосу
            </Button>
          </Empty>
        )}
      </section>
      {adding && (
        <ParticipantForm
          onClose={() => setAdding(false)}
          onSaved={(p) => navigate(`/participants/${p._id}`)}
        />
      )}
    </>
  );
}
export function ParticipantDetail() {
  const { id } = useParams();
  const [year, setYear] = useState(
    Number(new URLSearchParams(location.search).get("year")) ||
      defaultFilters.year,
  );
  const [edit, setEdit] = useState(false),
    [payment, setPayment] = useState<any>(null),
    [confirm, setConfirm] = useState<any>(null);
  const [receiptText, setReceiptText] = useState("");
  const [paymentOrder, setPaymentOrder] = useState<"asc" | "desc">("desc");
  const query = useQuery({
    queryKey: ["participant", id, year],
    queryFn: () => api(`/participants/${id}?year=${year}`),
  });
  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorBox error={query.error} />;
  const p = query.data;
  const payments = sortPayments<any>(
    p.payments.filter((x: any) => x.year === year),
    paymentOrder,
  );
  return (
    <>
      <Link to="/participants" className="back-link">
        <ArrowLeft size={18} />
        Қатысушылар тізіміне
      </Link>
      <PageHeading
        title={
          [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ") ||
          "Аты-жөні көрсетілмеген"
        }
        description={
          p.age == null
            ? "Туған күні көрсетілмеген"
            : `${p.age} жас · ${AGE_LABELS[p.ageGroup]}`
        }
      >
        <Button variant="outline" onClick={() => setEdit(true)}>
          <Pencil size={18} />
          Өзгерту
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setConfirm({
              title: p.archivedAt
                ? "Қатысушыны қайтару керек пе?"
                : "Қатысушыны мұрағатқа жіберу керек пе?",
              description:
                "Мәліметтері мен төлем тарихы сақталады. Қатысушыны кейін қайтара аласыз.",
              action: async () => {
                await send(`/participants/${id}/archive`, {
                  restore: !!p.archivedAt,
                });
                await queryClient.invalidateQueries();
                toast.success(
                  p.archivedAt ? "Қатысушы қайтарылды" : "Мұрағатқа жіберілді",
                );
              },
            })
          }
        >
          {p.archivedAt ? <RotateCcw size={18} /> : <Archive size={18} />}{" "}
          {p.archivedAt ? "Тізімге қайтару" : "Мұрағатқа жіберу"}
        </Button>
      </PageHeading>
      {p.archivedAt && (
        <div className="notice-strip">
          Бұл қатысушы мұрағатта. Жаңа төлем қосу үшін тізімге қайтарыңыз.
        </div>
      )}
      {missingParticipantFields(p).length > 0 && (
        <div className="notice-strip">
          <strong>Толық емес.</strong> Толтыру керек:{" "}
          {missingParticipantFields(p).join(", ")}. «Өзгерту» батырмасын басып,
          кейін толықтыра аласыз.
        </div>
      )}
      <div className="detail-grid">
        <section className="panel profile-panel">
          <h2>Қатысушы туралы</h2>
          <dl>
            <div>
              <dt>
                <CalendarDays size={18} />
                Туған күні
              </dt>
              <dd>{p.birthDate || "Көрсетілмеген"}</dd>
            </div>
            <div>
              <dt>
                <MapPin size={18} />
                Елді мекен
              </dt>
              <dd>{locationLabel(p.region, p.village) || "Көрсетілмеген"}</dd>
            </div>
            <div>
              <dt>
                <Phone size={18} />
                Телефоны
              </dt>
              <dd>
                {p.phone ? (
                  <a href={`tel:${p.phone}`}>{p.phone}</a>
                ) : (
                  "Көрсетілмеген"
                )}
              </dd>
            </div>
            {(p.lastNameLatin || p.firstNameLatin) && (
              <div>
                <dt>Латынша аты-жөні</dt>
                <dd>
                  {p.lastNameLatin} {p.firstNameLatin}
                </dd>
              </div>
            )}
          </dl>
          {p.notes && (
            <section>
              <h3 className="form-section-label">Ескертпе</h3>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {p.notes}
              </p>
            </section>
          )}
          <h3 className="form-section-label">Жеке куәлік</h3>
          <dl>
            {IDENTITY_FIELDS.filter(([key]) => !key.endsWith("Date")).map(
              ([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{p[key] || "Көрсетілмеген"}</dd>
                </div>
              ),
            )}
            <div>
              <dt>Жарамдылық мерзімі</dt>
              <dd>{validityPeriod(p.issueDate, p.expiryDate)}</dd>
            </div>
          </dl>
          {p.identityDocumentId ? (
            <DocumentButton documentId={p.identityDocumentId} kind="identity" />
          ) : (
            <p className="muted">Куәлік жүктелмеген</p>
          )}
        </section>
        <section className="panel contribution-panel">
          <div className="panel-heading">
            <h2>Мүшелік жарна</h2>
            <YearSelect value={year} onChange={setYear} />
          </div>
          <div className="contribution-values">
            <div>
              <span>Төленді</span>
              <strong>{money(p.totalPaid)}</strong>
            </div>
            <div>
              <span>Қалды</span>
              <strong>{money(p.remaining)}</strong>
            </div>
            <Status status={p.status} />
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label="Жарнаның төленуі"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(100, (p.totalPaid / FEE) * 100))}
          >
            <div
              style={{ width: `${Math.min(100, (p.totalPaid / FEE) * 100)}%` }}
            />
          </div>
          <div className="progress-caption">
            <span>Жылдық жарна: {money(FEE)}</span>
            <span>{Math.round(Math.min(100, (p.totalPaid / FEE) * 100))}%</span>
          </div>
          {p.overpayment > 0 && (
            <p className="hint-strip">
              <Check size={18} />
              Артық төлем: {money(p.overpayment)}. Келесі жылға автоматты
              көшірілмейді.
            </p>
          )}
          <Button
            disabled={!!p.archivedAt}
            onClick={() => setPayment({ new: true })}
          >
            <Plus size={20} />
            Төлем қосу
          </Button>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Төлем тарихы</h2>
            <p>{year} жылғы жарнаға тіркелген төлемдер</p>
          </div>
          <label className="sort-field">
            Төлем күні мен уақыты
            <select
              value={paymentOrder}
              onChange={(e) =>
                setPaymentOrder(e.target.value as "asc" | "desc")
              }
            >
              <option value="desc">Жаңа төлемдер алдымен</option>
              <option value="asc">Ескі төлемдер алдымен</option>
            </select>
          </label>
          <span className="count-label">{payments.length} жазба</span>
        </div>
        {payments.length ? (
          <div className="table-scroll">
            <table role="table" className="record-table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Төлем күні мен уақыты
                  </th>
                  <th scope="col" role="columnheader">
                    Сома
                  </th>
                  <th scope="col" role="columnheader">
                    Төлеген адам
                  </th>
                  <th scope="col" role="columnheader">
                    Алушы / чек нөмірі
                  </th>
                  <th scope="col" role="columnheader">
                    Чек
                  </th>
                  <th scope="col" role="columnheader">
                    Әрекеттер
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {payments.map((pay: any) => (
                  <tr
                    role="row"
                    key={pay._id}
                    className={pay.voidedAt ? "voided" : ""}
                  >
                    <td role="cell" data-label="Төлем күні мен уақыты">
                      {pay.paymentDate?.split("-").reverse().join(".")}
                      <small className="table-sub">
                        {pay.paymentTime || "Уақыты көрсетілмеген"}
                      </small>
                    </td>
                    <td role="cell" className="strong" data-label="Сома">
                      {money(pay.amount)}
                      {pay.voidedAt && <small>Күші жойылған</small>}
                    </td>
                    <td role="cell" data-label="Төлеген адам">
                      {pay.payerName || "Көрсетілмеген"}
                    </td>
                    <td role="cell" data-label="Алушы / чек нөмірі">
                      {pay.recipientName || "—"}
                      <small>
                        {pay.receiptNumber || "Нөмірі көрсетілмеген"}
                      </small>
                    </td>
                    <td role="cell" data-label="Чек">
                      {pay.receiptDocumentId ? (
                        <DocumentButton
                          documentId={pay.receiptDocumentId}
                          kind="receipt"
                          compact
                        />
                      ) : !pay.receiptText ? (
                        "—"
                      ) : null}
                      {pay.receiptText && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReceiptText(pay.receiptText)}
                        >
                          Мәтін
                        </Button>
                      )}
                    </td>
                    <td role="cell" data-label="Әрекеттер">
                      {!pay.voidedAt && (
                        <div className="row-actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!p.archivedAt}
                            onClick={() => setPayment(pay)}
                          >
                            Түзету
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setConfirm({
                                title: "Төлемнің күшін жою керек пе?",
                                description:
                                  "Бұл сома жарна есебінен алынады. Тарихта сақталады.",
                                action: async () => {
                                  await send(`/payments/${pay._id}/void`, {});
                                  await queryClient.invalidateQueries();
                                  toast.success("Төлемнің күші жойылды");
                                },
                              })
                            }
                          >
                            Күшін жою
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Бұл жылға төлем жоқ"
            description="Алғашқы төлемді қосқан соң, қалған сома автоматты есептеледі."
          />
        )}
      </section>
      {receiptText && (
        <Modal
          title="Чек мәтіні"
          description="WhatsApp-тан сақталған бастапқы мәтін"
          onClose={() => setReceiptText("")}
        >
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {receiptText}
          </p>
        </Modal>
      )}
      {edit && (
        <ParticipantForm participant={p} onClose={() => setEdit(false)} />
      )}
      {payment && (
        <PaymentForm
          participant={p}
          year={year}
          payment={payment.new ? undefined : payment}
          onClose={() => setPayment(null)}
        />
      )}
      {confirm && (
        <Confirm
          title={confirm.title}
          description={confirm.description}
          onClose={() => setConfirm(null)}
          onConfirm={confirm.action}
        />
      )}
    </>
  );
}
