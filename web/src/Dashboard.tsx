import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  CheckCheck,
  Wallet,
  ArrowUpRight,
  Plus,
  ReceiptText,
  FileDown,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { api, qs } from "./api";
import { money, AGE_LABELS } from "../../shared/domain";
import { Button } from "./components/ui/button";
import {
  PageHeading,
  YearSelect,
  defaultFilters,
  Filters,
  Loading,
  ErrorBox,
  Empty,
} from "./components/common";
import { ParticipantForm } from "./components/forms";
import { MemberTable } from "./Participants";
const colors = ["#1c7358", "#efb75c", "#e6e9e7"];
export function Dashboard() {
  const [filters, setFilters] = useState(defaultFilters),
    [showFilters, setShowFilters] = useState(false),
    [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["statistics", filters],
    queryFn: () => api("/statistics?" + qs(filters)),
  });
  const members = useQuery({
    queryKey: ["dashboard-members", filters],
    queryFn: () => api("/participants?" + qs({ ...filters, limit: 5 })),
  });
  const data = query.data;
  const totals = data?.totals;
  const pie = totals
    ? [
        { name: "Төленген", value: totals.paid },
        { name: "Ішінара төленген", value: totals.partial },
        { name: "Төленбеген", value: totals.unpaid },
      ]
    : [];
  return (
    <>
      <PageHeading
        eyebrow="ҰЙЫМНЫҢ КҮНДЕЛІКТІ ЕСЕБІ"
        title="Бәрі бір жерде."
        description="Қатысушылар, жарналар және қаржы — анық әрі оңай."
      >
        <YearSelect
          value={filters.year}
          onChange={(year) => setFilters({ ...filters, year })}
        />
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={18} />
          Іріктеу
        </Button>
      </PageHeading>
      {showFilters && (
        <section className="panel filter-section">
          <Filters value={filters} onChange={setFilters} year={false} />
        </section>
      )}
      <section className="welcome-banner">
        <div>
          <div className="banner-overline">
            <span />
            БІРЛІК БАР ЖЕРДЕ — ТІРЛІК БАР
          </div>
          <h2>Бүгін неден бастаймыз?</h2>
          <p>
            Қатысушы қосыңыз, төлемді белгілеңіз
            <br className="desktop-break" /> немесе дайын есепті жүктеп алыңыз.
          </p>
        </div>
        <div className="quick-actions">
          <button onClick={() => setAdding(true)}>
            <span className="quick-icon">
              <Plus size={25} />
            </span>
            <strong>
              Қатысушы
              <br />
              қосу
            </strong>
            <ArrowUpRight size={19} />
          </button>
          <Link to="/membership">
            <span className="quick-icon">
              <ReceiptText size={25} />
            </span>
            <strong>
              Төлем
              <br />
              қосу
            </strong>
            <ArrowUpRight size={19} />
          </Link>
          <Link to="/reports">
            <span className="quick-icon">
              <FileDown size={25} />
            </span>
            <strong>
              Есепті
              <br />
              жүктеу
            </strong>
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="banner-decoration" aria-hidden="true">
          ✳
        </div>
      </section>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="section-kicker">
            <h2>{filters.year} жылға шолу</h2>
            <span>Таңдалған қатысушылар бойынша</span>
          </div>
          <div className="stats-grid">
            {[
              {
                label: "Барлық қатысушы",
                value: totals.count.toLocaleString("kk-KZ"),
                note: "Есепте тұрған адамдар",
                icon: Users,
                style: "blue",
              },
              {
                label: "Толық төлегендер",
                value: totals.paid.toLocaleString("kk-KZ"),
                note: `${totals.count ? Math.round((totals.paid / totals.count) * 100) : 0}% қатысушы жарнасын төледі`,
                icon: CheckCheck,
                style: "green",
              },
              {
                label: "Жиналған жарна",
                value: money(totals.totalPaid),
                note: `${filters.year} жылғы жарнаға төленді`,
                icon: Wallet,
                style: "green",
              },
              {
                label: "Төленуі қалған сома",
                value: money(totals.remaining),
                note: `${totals.unpaid + totals.partial} қатысушыда қалдық бар`,
                icon: ReceiptText,
                style: "amber",
              },
            ].map((card) => (
              <div className="stat-card" key={card.label}>
                <div className="stat-top">
                  <span>{card.label}</span>
                  <span className={`stat-icon ${card.style}`}>
                    <card.icon size={21} />
                  </span>
                </div>
                <strong>{card.value}</strong>
                <small>{card.note}</small>
              </div>
            ))}
          </div>
          <div className="charts-grid">
            <section className="panel payment-chart">
              <div className="panel-heading">
                <div>
                  <h2>Жарнаның төленуі</h2>
                  <p>Кім төледі, кімнің төлеуі қалды</p>
                </div>
                <span className="year-chip">{filters.year}</span>
              </div>
              {totals.count ? (
                <div className="donut-content">
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pie}
                          dataKey="value"
                          innerRadius={72}
                          outerRadius={95}
                          stroke="none"
                          paddingAngle={3}
                          startAngle={90}
                          endAngle={-270}
                        >
                          {pie.map((_, i) => (
                            <Cell key={i} fill={colors[i]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <strong>{totals.count.toLocaleString("kk-KZ")}</strong>
                      <span>қатысушы</span>
                    </div>
                  </div>
                  <div className="legend">
                    {pie.map((x, i) => (
                      <div key={x.name}>
                        <span
                          className="legend-dot"
                          style={{ background: colors[i] }}
                        />
                        <span>{x.name}</span>
                        <strong>{x.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty
                  title="Алғашқы қатысушыны қосыңыз"
                  description="Жарналардың төленуі осы жерде көрінеді."
                />
              )}
            </section>
            <section className="panel region-chart">
              <div className="panel-heading">
                <div>
                  <h2>Аймақтар бойынша</h2>
                  <p>Қатысушылардың орналасуы</p>
                </div>
                <span className="region-label">Маңғыстау облысы</span>
              </div>
              <div className="region-bars">
                {data.regions.length ? (
                  [...data.regions]
                    .sort((a: any, b: any) => b.count - a.count)
                    .map((r: any) => (
                      <div
                        className="region-row"
                        key={r._id || "Аймағы көрсетілмеген"}
                      >
                        <div>
                          <span>{r._id || "Аймағы көрсетілмеген"}</span>
                          <strong>{r.count}</strong>
                        </div>
                        <div className="region-track">
                          <span
                            style={{
                              width: `${(r.count / Math.max(...data.regions.map((v: any) => v.count))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                ) : (
                  <Empty
                    title="Аймақтар әзірге бос"
                    description="Қатысушы қосқанда, аймағын таңдаңыз."
                  />
                )}
              </div>
            </section>
          </div>
          <section className="panel members-preview">
            <div className="panel-heading">
              <div>
                <h2>Қатысушылар тізімі</h2>
                <p>Мәліметін көру үшін аты-жөніне басыңыз</p>
              </div>
              <Link to="/participants" className="text-link">
                Барлығын көру <ArrowRight size={17} />
              </Link>
            </div>
            {members.isLoading ? (
              <Loading />
            ) : members.isError ? (
              <ErrorBox error={members.error} />
            ) : members.data?.items.length ? (
              <MemberTable
                compact
                items={members.data.items}
                year={filters.year}
              />
            ) : (
              <Empty
                title="Тізімде әзірге ешкім жоқ"
                description="«Қатысушы қосу» батырмасынан бастаңыз."
              />
            )}
          </section>
          <div className="charts-grid lower-charts">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Жас санаттары</h2>
                  <p>Таңдалған қатысушылар бойынша</p>
                </div>
              </div>
              <div className="age-list">
                {[...AGE_LABELS, "Туған күні көрсетілмеген"].map((label, i) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>
                      {data.ages.find(
                        (x: any) =>
                          x._id === (i === AGE_LABELS.length ? null : i),
                      )?.count || 0}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Ай сайынғы кіріс пен шығыс</h2>
                  <p>Ұйым бойынша · төлем жасалған күнмен есептеледі</p>
                </div>
              </div>
              <div className="bar-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.finance.months.map((x: any) => ({
                      ...x,
                      membership: x.membership / 100,
                      income: x.income / 100,
                      expense: x.expense / 100,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      width={55}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${v / 1000} мың` : String(v)
                      }
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) =>
                        `${Number(v).toLocaleString("kk-KZ")} ₸`
                      }
                    />
                    <Bar
                      name="Мүшелік жарналар"
                      dataKey="membership"
                      fill="#1c7358"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar name="Өзге кіріс" dataKey="income" fill="#93b9aa" />
                    <Bar
                      name="Шығыс"
                      dataKey="expense"
                      fill="#efb75c"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}
      {adding && (
        <ParticipantForm
          onClose={() => setAdding(false)}
          onSaved={(p) => navigate(`/participants/${p._id}`)}
        />
      )}
    </>
  );
}
