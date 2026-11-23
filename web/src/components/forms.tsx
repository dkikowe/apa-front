import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, AlertTriangle } from "lucide-react";
import {
  participantSchema,
  IDENTITY_FIELDS,
  validityPeriod,
  missingParticipantFields,
  REGIONS,
  ageAt,
  ageGroup,
  AGE_LABELS,
  money,
  parseMoney,
  today,
  FEE,
} from "../../../shared/domain";
import { api, send, queryClient, ApiError } from "../api";
import { Button } from "./ui/button";
import { Modal, Field } from "./common";
import { DocumentUpload } from "./DocumentUpload";
export function ParticipantForm({
  participant,
  onClose,
  onSaved,
}: {
  participant?: any;
  onClose: () => void;
  onSaved?: (p: any) => void;
}) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const form = useForm<any>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      middleName: "",
      notes: "",
      lastNameLatin: "",
      firstNameLatin: "",
      birthDate: "",
      region: "",
      village: "",
      phone: "",
      iin: "",
      documentNumber: "",
      issuedBy: "",
      issueDate: "",
      expiryDate: "",
      ...participant,
    },
  });
  const birth = form.watch("birthDate");
  const missing = missingParticipantFields(form.watch());
  return (
    <Modal
      title={participant ? "Қатысушыны өзгерту" : "Жаңа қатысушы қосу"}
      description="Куәлікті жүктеңіз немесе мәліметтерді өзіңіз толтырыңыз."
      onClose={() => !form.formState.isSubmitting && !uploading && onClose()}
    >
      <form
        onSubmit={form.handleSubmit(async (values) => {
          if (uploading) return;
          setError("");
          try {
            const p = await send(
              participant
                ? `/participants/${participant._id}`
                : "/participants",
              values,
              participant ? "PATCH" : "POST",
            );
            await queryClient.invalidateQueries();
            toast.success(
              participant ? "Өзгерістер сақталды" : "Қатысушы қосылды",
            );
            onSaved?.(p);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        <DocumentUpload
          kind="identity"
          onUploading={setUploading}
          onDocument={(id) => form.setValue("identityDocumentId", id)}
          onFields={(fields) => {
            for (const [key, value] of Object.entries(fields)) {
              if (!form.getFieldState(key).isDirty)
                form.setValue(key, value, { shouldValidate: true });
            }
          }}
        />
        {missing.length > 0 && (
          <p className="notice-strip">
            <strong>Толық емес.</strong> Белгісіз мәліметтерді бос қалдырып,
            сақтай аласыз. Кейін толықтырыңыз.
          </p>
        )}
        <div className="form-section-label">Қатысушы туралы</div>
        <div className="form-grid">
          {[
            ["lastName", "Тегі"],
            ["firstName", "Аты"],
            ["middleName", "Әкесінің аты"],
            ["birthDate", "Туған күні"],
            ["region", "Аймағы"],
            ["village", "Ауыл (бар болса)"],
            ["phone", "Телефон нөмірі"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              error={form.formState.errors[key]?.message as string}
            >
              {key === "region" ? (
                <select {...form.register(key)}>
                  <option value="">Аймақты таңдаңыз</option>
                  {REGIONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    key === "birthDate"
                      ? "date"
                      : key === "phone"
                        ? "tel"
                        : "text"
                  }
                  max={key === "birthDate" ? today() : undefined}
                  placeholder={key === "phone" ? "+7 7__ ___ __ __" : undefined}
                  {...form.register(key)}
                />
              )}
            </Field>
          ))}
        </div>
        {birth && ageAt(birth) >= 0 && (
          <p className="hint-strip">
            Жасы: <strong>{ageAt(birth)}</strong> ·{" "}
            {AGE_LABELS[ageGroup(ageAt(birth)) ?? 0]}
          </p>
        )}
        <section aria-label="Жеке куәлік мәліметтері">
          <h3 className="form-section-label">Жеке куәлік мәліметтері</h3>
          <p className="small-note">
            Құжатта жоқ мәліметті бос қалдырыңыз. Автоматты оқылған мәліметті
            сақтамас бұрын тексеріңіз.
          </p>
          <div className="form-grid">
            {IDENTITY_FIELDS.filter(([key]) => !key.endsWith("Date")).map(
              ([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  error={form.formState.errors[key]?.message as string}
                >
                  <input
                    type={key.endsWith("Date") ? "date" : "text"}
                    inputMode={key === "iin" ? "numeric" : undefined}
                    maxLength={
                      key === "iin" ? 12 : key === "issuedBy" ? 200 : undefined
                    }
                    {...form.register(key)}
                  />
                </Field>
              ),
            )}
          </div>
          <fieldset className="validity-fields">
            <legend>Жарамдылық мерзімі</legend>
            <div className="form-grid">
              <Field
                label="Басталуы"
                error={form.formState.errors.issueDate?.message as string}
              >
                <input type="date" {...form.register("issueDate")} />
              </Field>
              <Field
                label="Аяқталуы"
                error={form.formState.errors.expiryDate?.message as string}
              >
                <input type="date" {...form.register("expiryDate")} />
              </Field>
            </div>
            <p className="hint-strip">
              {validityPeriod(
                form.watch("issueDate"),
                form.watch("expiryDate"),
              )}
            </p>
          </fieldset>
        </section>
        <details className="optional-fields">
          <summary>Қосымша: латынша аты-жөні</summary>
          <div className="form-grid">
            <Field label="Латынша тегі">
              <input {...form.register("lastNameLatin")} />
            </Field>
            <Field label="Латынша аты">
              <input {...form.register("firstNameLatin")} />
            </Field>
          </div>
          <p>Куәлікте қалай жазылса, солай енгізіңіз.</p>
        </details>
        <Field
          label="Ескертпе"
          error={form.formState.errors.notes?.message as string}
        >
          <textarea rows={4} maxLength={4000} {...form.register("notes")} />
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={form.formState.isSubmitting || uploading}
          >
            Бас тарту
          </Button>
          <Button disabled={form.formState.isSubmitting || uploading}>
            <Check size={18} />
            {form.formState.isSubmitting ? "Сақталуда…" : "Қатысушыны сақтау"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function PaymentForm({
  participant,
  year,
  payment,
  onClose,
}: {
  participant: any;
  year: number;
  payment?: any;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>({
    year,
    amount: payment ? String(payment.amount / 100) : "",
    paymentDate: today(),
    paymentTime: "",
    recipientName: "",
    receiptNumber: "",
    method: "",
    notes: "",
    ...payment,
    ...(payment ? { amount: String(payment.amount / 100) } : {}),
  });
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [duplicate, setDuplicate] = useState(false);
  const update = (key: string, value: any) => {
    setData((old: any) => ({ ...old, [key]: value }));
    setTouched((old) => ({ ...old, [key]: true }));
    setDuplicate(false);
  };
  const save = async (confirmDuplicate = false) => {
    if (uploading) return;
    setBusy(true);
    setError("");
    try {
      await send(
        payment
          ? `/payments/${payment._id}`
          : `/participants/${participant._id}/payments`,
        {
          ...data,
          amount: parseMoney(data.amount),
          year: Number(data.year),
          confirmDuplicate,
        },
        payment ? "PATCH" : "POST",
      );
      await queryClient.invalidateQueries();
      toast.success("Төлем сақталды. Қалған сома жаңартылды.");
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setDuplicate(true);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={payment ? "Төлемді түзету" : "Төлем қосу"}
      description={`${participant.lastName} ${participant.firstName} · жылдық жарна ${money(FEE)}`}
      onClose={() => !busy && !uploading && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <DocumentUpload
          kind="receipt"
          onUploading={setUploading}
          onDocument={(id) => update("receiptDocumentId", id)}
          onFields={(fields) => {
            setData((old: any) => {
              const next = { ...old };
              for (const key of [
                "amount",
                "paymentDate",
                "paymentTime",
                "recipientName",
                "receiptNumber",
                "method",
              ]) {
                const value = fields[key];
                if (!touched[key])
                  next[key] =
                    value == null
                      ? ""
                      : key === "amount"
                        ? String(Number(value) / 100)
                        : value;
              }
              return next;
            });
          }}
        />
        <div className="form-grid">
          <Field label="Төленген сома, ₸ *">
            <input
              autoFocus
              inputMode="decimal"
              required
              value={data.amount}
              onChange={(e) => update("amount", e.target.value)}
              placeholder="Мысалы, 6 487"
            />
          </Field>
          <Field label="Қай жылға төленді? *">
            <input
              type="number"
              min={2000}
              max={2100}
              required
              value={data.year}
              onChange={(e) => update("year", e.target.value)}
            />
          </Field>
          <Field label="Төлем күні *">
            <input
              type="date"
              required
              value={data.paymentDate}
              onChange={(e) => update("paymentDate", e.target.value)}
            />
          </Field>
          <Field label="Төлем уақыты (Астана уақыты)">
            <input
              type="time"
              step="1"
              value={data.paymentTime}
              onChange={(e) => update("paymentTime", e.target.value)}
            />
            <span className="small-note">Чекте жоқ болса, бос қалдырыңыз.</span>
          </Field>
          <Field label="Алушының атауы">
            <input
              value={data.recipientName}
              onChange={(e) => update("recipientName", e.target.value)}
            />
          </Field>
          <Field label="Чек нөмірі">
            <input
              value={data.receiptNumber}
              onChange={(e) => update("receiptNumber", e.target.value)}
            />
          </Field>
          <Field label="Төлем тәсілі">
            <input
              placeholder="Қолма-қол, аударым…"
              value={data.method}
              onChange={(e) => update("method", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Ескерту">
          <textarea
            value={data.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </Field>
        <p className="small-note">
          Сақтамас бұрын ақша түскенін тексеріңіз. Чектің оқылуы банктегі
          түсімді растамайды.
        </p>
        {duplicate && (
          <div className="duplicate-warning" role="alert">
            <AlertTriangle size={22} />
            <div>
              <strong>Бұл чек бұрын тіркелген болуы мүмкін</strong>
              <p>Қайта қоссаңыз, сома тағы бір рет есепке алынады.</p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || uploading}
                onClick={() => void save(true)}
              >
                Тексердім, бөлек төлем ретінде қосу
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy || uploading}
            onClick={onClose}
          >
            Бас тарту
          </Button>
          <Button disabled={busy || duplicate || uploading}>
            <Check size={18} />
            {busy ? "Сақталуда…" : "Төлемді сақтау"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function FinanceForm({
  transaction,
  onClose,
}: {
  transaction?: any;
  onClose: () => void;
}) {
  const [data, setData] = useState({
    type: "expense",
    date: today(),
    amount: "",
    category: "",
    description: "",
    ...transaction,
    ...(transaction ? { amount: String(transaction.amount / 100) } : {}),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = (k: string, v: string) => setData({ ...data, [k]: v });
  return (
    <Modal
      title={transaction ? "Жазбаны өзгерту" : "Кіріс немесе шығыс қосу"}
      description="Мүшелік жарналарды «Төлем қосу» арқылы енгізіңіз."
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              transaction ? `/finance/${transaction._id}` : "/finance",
              {
                method: transaction ? "PATCH" : "POST",
                body: JSON.stringify({
                  ...data,
                  amount: parseMoney(data.amount),
                }),
              },
            );
            await queryClient.invalidateQueries();
            toast.success("Жазба сақталды");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Түрі">
            <select
              value={data.type}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="expense">Шығыс — жұмсалған ақша</option>
              <option value="income">Кіріс — түскен ақша</option>
            </select>
          </Field>
          <Field label="Сома, ₸ *">
            <input
              required
              inputMode="decimal"
              value={data.amount}
              onChange={(e) => update("amount", e.target.value)}
            />
          </Field>
          <Field label="Күні *">
            <input
              required
              type="date"
              value={data.date}
              onChange={(e) => update("date", e.target.value)}
            />
          </Field>
          <Field label="Санаты *">
            <input
              required
              list="categories"
              value={data.category}
              onChange={(e) => update("category", e.target.value)}
            />
            <datalist id="categories">
              {[
                "Жалдау ақысы",
                "Коммуналдық төлем",
                "Кеңсе заттары",
                "Құрал-жабдық",
                "Өзге түсім",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Түсініктеме">
          <textarea
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Бас тарту
          </Button>
          <Button disabled={busy}>{busy ? "Сақталуда…" : "Сақтау"}</Button>
        </div>
      </form>
    </Modal>
  );
}
