import { useRef, useState } from "react";
import { Upload, Check, FileDown } from "lucide-react";
import { api, send, queryClient } from "../api";
import { today, money } from "../../../shared/domain";
import { Modal, Field } from "./common";
import { Button } from "./ui/button";

type Preview = {
  sheets: { id: number; name: string }[];
  sheet: number;
  headerRow: number;
  columns: { index: number; label: string }[];
  mapping: Record<string, number>;
  fields: { key: string; label: string }[];
  missing: string[];
  total: number;
  ready: number;
  duplicates: number;
  errorCount: number;
  issues: { row: number; message: string }[];
  examples: {
    row: number;
    name: string;
    birthDate?: string;
    region?: string;
    phone?: string;
    documentNumber?: string;
    amount?: number;
    status: string;
    message?: string;
  }[];
  draftId?: string;
};
export function ExcelImport({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<Preview>();
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState<number>();
  const [headerRow, setHeaderRow] = useState(1);
  const [year, setYear] = useState(Number(today().slice(0, 4)));
  const [paymentDate, setPaymentDate] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    created: number;
    payments: number;
    skipped: number;
  }>();
  const inspect = async (selected: File, auto = false) => {
    setBusy(true);
    setError("");
    setPreview(undefined);
    try {
      if (selected.size > 10 * 1024 * 1024)
        throw new Error("Файл 10 МБ-тан аспауы керек.");
      const body = new FormData();
      body.append("file", selected);
      body.append(
        "options",
        JSON.stringify(
          auto ? {} : { sheet, headerRow, mapping, year, paymentDate },
        ),
      );
      const data = await api<Preview>("/participants/import/preview", {
        method: "POST",
        body,
      });
      setPreview(data);
      setMapping(data.mapping);
      setSheet(data.sheet);
      setHeaderRow(data.headerRow);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const change = () => {
    setDirty(true);
    setError("");
  };
  return (
    <Modal
      title="Excel-ден қатысушыларды қосу"
      description="1. Файлды таңдаңыз. 2. Мәліметтерді тексеріңіз. 3. Қосу батырмасын басыңыз."
      onClose={() => !busy && onClose()}
    >
      {result ? (
        <section className="import-success" role="status">
          <Check size={40} />
          <h3>{result.created} қатысушы қосылды</h3>
          <p>
            {result.payments} төлем сақталды.{" "}
            {result.skipped > 0
              ? `${result.skipped} қайталанған жазба өткізілді.`
              : ""}
          </p>
          <Button onClick={onClose}>Тізімге оралу</Button>
        </section>
      ) : (
        <>
          <div className="import-file-actions">
            <Button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={22} />
              {file ? "Басқа файл таңдау" : "Excel файлын таңдау"}
            </Button>
            <a
              className="button button-outline"
              href="/api/participants/import/template"
              download
            >
              <FileDown size={22} />
              Бос үлгіні жүктеу
            </a>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const next = e.target.files?.[0];
                e.target.value = "";
                if (next) {
                  setFile(next);
                  void inspect(next, true);
                }
              }}
            />
          </div>
          <p className="small-note">
            .xlsx · 10 МБ-қа дейін · 5000 жолға дейін. Файл тексерілгенше ештеңе
            базаға қосылмайды.
          </p>
          {file && (
            <p className="file-name">
              Таңдалған файл: <strong>{file.name}</strong>
            </p>
          )}
          {busy && <p role="status">Күте тұрыңыз, файл өңделуде…</p>}
          {preview && (
            <>
              <details
                className="import-mapping"
                open={preview.missing.length > 0 || dirty || undefined}
              >
                <summary>Бағандарды сәйкестендіру және парақты таңдау</summary>
                <div className="form-grid">
                  <Field label="Excel парағы">
                    <select
                      value={sheet}
                      disabled={busy}
                      onChange={async (e) => {
                        const selected = Number(e.target.value);
                        setBusy(true);
                        setError("");
                        setDirty(true);
                        try {
                          const body = new FormData();
                          body.append("file", file!);
                          body.append(
                            "options",
                            JSON.stringify({ sheet: selected }),
                          );
                          const data = await api<Preview>(
                            "/participants/import/preview",
                            { method: "POST", body },
                          );
                          setPreview(data);
                          setSheet(data.sheet);
                          setHeaderRow(data.headerRow);
                          setMapping(data.mapping);
                          setDirty(false);
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {preview.sheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Баған атаулары тұрған жол">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={headerRow}
                      onChange={(e) => {
                        setHeaderRow(Number(e.target.value));
                        change();
                      }}
                    />
                  </Field>
                  {preview.fields.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <select
                        value={mapping[f.key] || ""}
                        onChange={(e) => {
                          setMapping((old) => {
                            const next = { ...old };
                            if (e.target.value)
                              next[f.key] = Number(e.target.value);
                            else delete next[f.key];
                            return next;
                          });
                          change();
                        }}
                      >
                        <option value="">Бұл баған жоқ / қоспау</option>
                        {preview.columns.map((c) => (
                          <option key={c.index} value={c.index}>
                            {c.index}. {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
                <p className="small-note">
                  «Төленді» бағанын таңдасаңыз, сомалар төлем ретінде сақталады.
                  Тек қатысушыларды қосу үшін осы бағанды «қоспау» күйінде
                  қалдырыңыз.
                </p>
                {mapping.amount && (
                  <div className="form-grid">
                    <Field label="Файлда жыл жоқ болса, қай жылға төленді?">
                      <input
                        type="number"
                        min={2000}
                        max={2100}
                        value={year}
                        onChange={(e) => {
                          setYear(Number(e.target.value));
                          change();
                        }}
                      />
                    </Field>
                    <Field label="Файлда төлем күні жоқ болса, күнін таңдаңыз">
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => {
                          setPaymentDate(e.target.value);
                          change();
                        }}
                      />
                    </Field>
                  </div>
                )}
              </details>
              {preview.missing.length > 0 && (
                <p className="field-error" role="alert">
                  Міндетті бағандарды таңдаңыз: {preview.missing.join(", ")}.
                </p>
              )}
              {dirty && (
                <p className="notice-strip">
                  Бағандар өзгерді. Сақтау алдында «Қайта тексеру» батырмасын
                  басыңыз.
                </p>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => file && void inspect(file)}
              >
                Қайта тексеру
              </Button>
              <section className="import-summary" aria-live="polite">
                <strong>{preview.total} жол оқылды</strong>
                <span>{preview.ready} жаңа қатысушы</span>
                <span>{preview.duplicates} қайталанған жол — қосылмайды</span>
                <span>{preview.errorCount} қате</span>
              </section>
              <p className="small-note">
                Бұрын бар қатысушылардың мәліметтері өзгермейді. Бірдей ЖСН,
                куәлік нөмірі немесе тегі + аты + туған күні қайталанған жазба
                болып саналады.
              </p>
              {preview.issues.length > 0 && (
                <div className="import-issues" role="alert">
                  <h3>Excel-де түзетіп, қайта жүктеңіз</h3>
                  <ul>
                    {preview.issues.map((i) => (
                      <li key={i.row}>
                        <strong>{i.row}-жол:</strong> {i.message}
                      </li>
                    ))}
                  </ul>
                  {preview.errorCount > 100 && (
                    <p>Алғашқы 100 қате көрсетілді.</p>
                  )}
                </div>
              )}
              {preview.examples.length > 0 && (
                <div className="table-scroll import-preview">
                  <table>
                    <caption>
                      Алдын ала қарау — алғашқы {preview.examples.length} жол
                    </caption>
                    <thead>
                      <tr>
                        <th>Жол</th>
                        <th>Аты-жөні</th>
                        <th>Туған күні</th>
                        <th>Аймақ</th>
                        <th>Телефон</th>
                        <th>Куәлік №</th>
                        <th>Төленді</th>
                        <th>Нәтиже</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.examples.map((r) => (
                        <tr key={r.row}>
                          <td>{r.row}</td>
                          <td>{r.name || "Аты-жөні жоқ"}</td>
                          <td>{r.birthDate || "—"}</td>
                          <td>{r.region || "—"}</td>
                          <td>{r.phone || "—"}</td>
                          <td>{r.documentNumber || "—"}</td>
                          <td>{money(r.amount || 0)}</td>
                          <td>
                            {r.status === "ready"
                              ? "Қосылады"
                              : r.status === "duplicate"
                                ? "Қайталанған"
                                : r.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Жабу
            </Button>
            <Button
              disabled={
                busy || dirty || !preview?.draftId || !!preview.errorCount
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  setResult(
                    await send(
                      `/participants/import/${preview!.draftId}/commit`,
                      {},
                    ),
                  );
                  await queryClient.invalidateQueries();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={22} />
              {busy ? "Сақталуда…" : `${preview?.ready || 0} қатысушыны қосу`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
