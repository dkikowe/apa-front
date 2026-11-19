import { useEffect, useState } from "react";
import {
  NavLink,
  useLocation,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ChartNoAxesCombined,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  HelpCircle,
  Menu,
  X,
  ArrowRight,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { displayDate } from "../../shared/domain";
import { api, send, setCsrf, queryClient, ApiError } from "./api";
import { Button } from "./components/ui/button";
import { Field, Loading, ErrorBox, Modal } from "./components/common";
import { Dashboard } from "./Dashboard";
import { Participants, ParticipantDetail } from "./Participants";
import { FinancePage, Reports, Settings } from "./OtherPages";
const nav = [
  { path: "/", label: "Басты бет", icon: LayoutDashboard },
  { path: "/participants", label: "Қатысушылар", icon: Users },
  { path: "/membership", label: "Мүшелік жарналар", icon: Wallet },
  { path: "/finance", label: "Қаржы", icon: ChartNoAxesCombined },
  { path: "/reports", label: "Есептер", icon: FileText },
];
function Logo() {
  return (
    <div className="brand">
      <img src="/favicon.svg" alt="" />
      <div>
        <strong>
          бірлік<span>•</span>
        </strong>
        <small>ҰЙЫМНЫҢ ОРТАҚ ЕСЕБІ</small>
      </div>
    </div>
  );
}
function Login() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="login-page">
      <section className="login-story">
        <Logo />
        <div>
          <span className="eyebrow">МАҢҒЫСТАУ ОБЛЫСЫ</span>
          <h1>
            Ортақ іс.
            <br />
            Анық есеп.
          </h1>
          <p>
            Қатысушылар мен жарналарды
            <br />
            оңай әрі ұқыпты есепке алыңыз.
          </p>
          <div className="login-ornament" aria-hidden="true">
            ✳
          </div>
        </div>
        <small>Бірлік бар жерде — тірлік бар.</small>
      </section>
      <main className="login-main">
        <form
          className="login-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const me = await send("/auth/login", { username, password });
              setCsrf(me.csrf);
              queryClient.setQueryData(["me"], me);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="login-lock">
            <LockKeyhole size={26} />
          </span>
          <h1>Қош келдіңіз!</h1>
          <p>Жұмысты бастау үшін жүйеге кіріңіз.</p>
          <Field label="Логин">
            <input
              name="username"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Логиніңізді енгізіңіз"
            />
          </Field>
          <Field label="Құпиясөз">
            <span className="password-field">
              <input
                name="password"
                autoComplete="current-password"
                required
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Құпиясөзіңізді енгізіңіз"
              />
              <button
                type="button"
                aria-label={
                  visible ? "Құпиясөзді жасыру" : "Құпиясөзді көрсету"
                }
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </Field>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <Button size="lg" disabled={busy}>
            {busy ? "Кіруде…" : "Жүйеге кіру"}
            <ArrowRight size={20} />
          </Button>
          <p className="login-note">
            Құпиясөзді ұмытсаңыз, жүйеге жауапты маманға хабарласыңыз.
          </p>
        </form>
      </main>
    </div>
  );
}
export default function App() {
  const location = useLocation();
  const activeTitle =
    nav.find((item) =>
      item.path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.path),
    )?.label || "Баптаулар";
  const navigate = useNavigate();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const data = await api("/auth/me");
        setCsrf(data.csrf);
        return data;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60000,
  });
  const [mobile, setMobile] = useState(false),
    [help, setHelp] = useState(false);
  const [compactNav, setCompactNav] = useState(
    () => window.matchMedia("(max-width: 1100px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    const update = () => {
      setCompactNav(media.matches);
      setMobile(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    document.getElementById("navigation-close")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false);
        document.getElementById("menu-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = overflow;
      document.getElementById("menu-toggle")?.focus();
    };
  }, [mobile]);
  if (me.isLoading) return <Loading />;
  if (me.isError)
    return <ErrorBox error={me.error} retry={() => void me.refetch()} />;
  if (!me.data) return <Login />;
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Мәзірді жабу"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="main-navigation"
        className={`sidebar ${mobile ? "is-open" : ""}`}
        inert={compactNav && !mobile}
        aria-label="Негізгі мәзір"
      >
        <Button
          className="nav-close"
          id="navigation-close"
          variant="outline"
          onClick={() => {
            setMobile(false);
            document.getElementById("menu-toggle")?.focus();
          }}
        >
          <X size={24} />
          Мәзірді жабу
        </Button>
        <Link to="/" onClick={() => setMobile(false)}>
          <Logo />
        </Link>
        <div className="workspace-badge">
          <span className="workspace-symbol">М</span>
          <div>
            <strong>Маңғыстау облысы</strong>
            <small>Қатысушылар есебі</small>
          </div>
        </div>
        <span className="nav-caption">НЕГІЗГІ МӘЗІР</span>
        <nav aria-label="Бөлімдер">
          {nav.map((item) => (
            <NavLink
              key={item.path}
              end={item.path === "/"}
              to={item.path}
              onClick={() => setMobile(false)}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
              <span className="nav-active-dot" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <HelpCircle size={21} />
            </span>
            <strong>Көмек керек пе?</strong>
            <p>
              Қалай жұмыс істеу керегін
              <br />
              бірге қарайық.
            </p>
            <button
              onClick={() => {
                setHelp(true);
                setMobile(false);
              }}
            >
              Қысқаша нұсқаулық <ArrowUpRightIcon />
            </button>
          </div>
          <NavLink
            className="settings-link"
            to="/settings"
            onClick={() => setMobile(false)}
          >
            <SettingsIcon size={21} />
            Баптаулар
          </NavLink>
          <div className="profile">
            <span className="profile-avatar">Ә</span>
            <div>
              <strong>Әкімші</strong>
              <small>{me.data.username}</small>
            </div>
            <Button
              variant="ghost"
              aria-label="Жүйеден шығу"
              title="Шығу"
              onClick={async () => {
                try {
                  await send("/auth/logout", {});
                  setCsrf("");
                  queryClient.clear();
                  queryClient.setQueryData(["me"], null);
                  navigate("/");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <LogOut size={20} />
              <span>Шығу</span>
            </Button>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={compactNav && mobile}>
        <header className="topbar">
          <div className="topbar-start">
            <Button
              variant="ghost"
              className="mobile-menu"
              id="menu-toggle"
              aria-controls="main-navigation"
              aria-expanded={mobile}
              aria-label={mobile ? "Мәзірді жабу" : "Мәзірді ашу"}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={24} /> : <Menu size={24} />}
              <span>Мәзір</span>
            </Button>
            <span className="topbar-breadcrumb">
              Ұйымды басқару <span>/</span> <strong>{activeTitle}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="locale-dot" />
            Қазақша <span className="topbar-divider" />
            <span className="today-label">{displayDate()}</span>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/participants" element={<Participants />} />
            <Route path="/participants/:id" element={<ParticipantDetail />} />
            <Route path="/membership" element={<Participants membership />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="page-footer">
            <span>Бірлік · Ұқыпты есеп, ортақ сенім</span>
            <span>Маңғыстау облысы</span>
          </footer>
        </main>
      </div>
      {help && (
        <Modal
          title="Қалай қолданамыз?"
          description="Күнделікті жұмысқа қажет үш қадам."
          onClose={() => setHelp(false)}
        >
          <ol className="help-steps">
            <li>
              <strong>Қатысушыны қосыңыз</strong>
              <p>
                «Қатысушы қосу» батырмасын басыңыз. Куәлікті жүктеңіз немесе
                аты-жөнін қолмен жазыңыз. Аймағы мен телефонын көрсетіп,
                сақтаңыз. Дайын тізім болса, «Қатысушылар» бөліміндегі
                «Excel-ден қосу» батырмасын басыңыз.
              </p>
            </li>
            <li>
              <strong>Төлемін белгілеңіз</strong>
              <p>
                Қатысушының атына басыңыз → «Төлем қосу». Сомасын және қай жылға
                төленгенін тексеріңіз. Қалған сома өзі есептеледі.
              </p>
            </li>
            <li>
              <strong>Есепті жүктеңіз</strong>
              <p>
                «Есептер» бөліміне кіріңіз. Жыл мен керек тізімді таңдап, «Excel
                файлын жүктеу» батырмасын басыңыз.
              </p>
            </li>
          </ol>
          <div className="hint-strip">
            Қате жіберсеңіз, «Өзгерту» немесе «Түзету» батырмасын басыңыз.
          </div>
          <div className="modal-actions">
            <Button onClick={() => setHelp(false)}>Түсінікті</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
