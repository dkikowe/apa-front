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
import { LocationSelect } from "./LocationSelect";
import { ReceiptTextInput } from "./ReceiptTextInput";
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
            ["phone", "Телефон нөмірі"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              error={form.formState.errors[key]?.message as string}
            >
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
            </Field>
          ))}
        </div>
        <LocationSelect
          region={form.watch("region") || ""}
          village={form.watch("village") || ""}
          error={
            (form.formState.errors.region?.message ||
              form.formState.errors.village?.message) as string
          }
          onChange={(region, village) => {
            form.setValue("region", region, {
              shouldDirty: true,
              shouldValidate: true,
            });
            form.setValue("village", village, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
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
        <section aria-label="Куәліктегі ағылшынша аты-жөні">
          <h3 className="form-section-label">Куәліктегі ағылшынша аты-жөні</h3>
          <div className="form-grid">
            <Field label="Ағылшынша тегі (Surname)">
              <input {...form.register("lastNameLatin")} />
            </Field>
            <Field label="Ағылшынша аты (Given names)">
              <input {...form.register("firstNameLatin")} />
            </Field>
          </div>
          <p className="small-note">
            Куәліктен автоматты оқылады. Жазылуын тексеріңіз; құжатта жоқ болса,
            бос қалдырыңыз.
          </p>
        </section>
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
    receiptText: "",
    recipientName: "",
    payerName: "",
    receiptNumber: "",
    method: "",
    notes: "",
    ...payment,
    ...(payment ? { amount: String(payment.amount / 100) } : {}),
  });
  const [uploading, setUploading] = useState(false);
  const [readingText, setReadingText] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [duplicate, setDuplicate] = useState(false);
  const update = (key: string, value: any) => {
    setData((old: any) => ({ ...old, [key]: value }));
    setTouched((old) => ({ ...old, [key]: true }));
    setDuplicate(false);
  };
  const applyReceiptFields = (fields: Record<string, string | number>) => {
    setData((old: any) => {
      const next = { ...old };
      for (const key of [
        "amount",
        "paymentDate",
        "paymentTime",
        "recipientName",
        "payerName",
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

    setDuplicate(false);
  };
  const save = async (confirmDuplicate = false) => {
    if (uploading || readingText) return;
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
      onClose={() => !busy && !uploading && !readingText && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <DocumentUpload
          kind="receipt"
          disabled={busy || readingText}
          onUploading={setUploading}
          onDocument={(id) => update("receiptDocumentId", id)}
          onFields={applyReceiptFields}
        />
        <ReceiptTextInput
          initialText={payment?.receiptText || ""}
          disabled={uploading || busy}
          onReading={setReadingText}
          onFields={(fields, text) => {
            applyReceiptFields(fields);
            setData((old: any) => ({ ...old, receiptText: text }));
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
          <Field label="Төлеген адам">
            <input
              value={data.payerName}
              onChange={(e) => update("payerName", e.target.value)}
              placeholder="Чектегі төлеушінің аты-жөні"
            />
            <span className="small-note">
              Басқа адам төлеген болса, чекте көрсетілген адамды жазыңыз.
            </span>
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
                disabled={busy || uploading || readingText}
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
            disabled={busy || uploading || readingText}
            onClick={onClose}
          >
            Бас тарту
          </Button>
          <Button disabled={busy || duplicate || uploading || readingText}>
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
