import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  participantSchema,
  IDENTITY_FIELDS,
  OPTIONAL_IDENTITY_FIELDS,
  invalidIdentityFields,
  validityPeriod,
  ageAt,
  ageGroup,
  AGE_LABELS,
  RECEIPT_TYPES,
  paymentCategoryLabel,
  parseMoney,
  today,
} from "../../../shared/domain";
import {
  identityAutofillUpdates,
  receiptAutofillUpdates,
  receiptKey,
} from "../../../shared/document-recognition";
import { api, send, queryClient, ApiError } from "../api";
import { previousAttachmentChanges } from "../document-status";
import { Button } from "./ui/button";
import { Modal, Field } from "./common";
import { LocationSelect } from "./LocationSelect";
import { ReceiptTextInput } from "./ReceiptTextInput";
import { DuplicateNotice } from "./DuplicateNotice";
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
  const [conflict, setConflict] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedValues] = useState(() => {
    const values = { ...participant };
    for (const key of invalidIdentityFields(values)) delete values[key];
    return values;
  });
  const form = useForm<any>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      middleName: "",
      fullNameKk: "",
      fullNameRu: "",
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
      sex: "",
      citizenship: "",
      birthplace: "",
      issueDate: "",
      expiryDate: "",
      ...savedValues,
    },
  });
  // Capture the version the user actually opened. Background refetches
  // must not silently replace the baseline of an already open form.
  const openedParticipant = useRef(participant);
  const autoFilled = useRef(new Set<string>());
  const preservedIdentity = useRef(new Set<string>());
  const manuallyEdited = (key: string) => preservedIdentity.current.has(key);
  const applyIdentityFields = (
    fields: Record<string, unknown>,
    fillBlanksOnly = false,
  ) => {
    const currentValues = form.getValues();
    const protectedValues = fillBlanksOnly
      ? currentValues
      : Object.fromEntries(
          ["issueDate", "expiryDate"]
            .filter(manuallyEdited)
            .map((key) => [key, currentValues[key]]),
        );
    const updates = identityAutofillUpdates(
      fields,
      autoFilled.current,
      manuallyEdited,
      protectedValues,
    );
    for (const [key, value] of Object.entries(updates)) {
      form.setValue(key, value, { shouldValidate: true });
      if (value) autoFilled.current.add(key);
      else autoFilled.current.delete(key);
    }
  };
  const birth = form.watch("birthDate");
  return (
    <Modal
      title={participant ? "Қатысушыны өзгерту" : "Жаңа қатысушы қосу"}
      onClose={() => !form.formState.isSubmitting && onClose()}
    >
      <form
        onChangeCapture={(event) => {
          // A deliberate correction can also be an empty value. React Hook
          // Form clears isDirty when it equals the original empty default.
          const input = event.target;
          if (input instanceof HTMLInputElement && input.name)
            preservedIdentity.current.add(input.name);
        }}
        onSubmit={form.handleSubmit(async (values) => {
          if (uploading || blocked) return;
          setError("");
          setConflict(null);
          try {
            const p = await send(
              participant
                ? `/participants/${participant._id}`
                : "/participants",
              participant
                ? {
                    ...values,
                    previousValues: Object.fromEntries(
                      Object.keys(values).map((key) => [
                        key,
                        String(openedParticipant.current?.[key] ?? ""),
                      ]),
                    ),
                  }
                : values,
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
            if (e instanceof ApiError && e.status === 412) {
              await queryClient.invalidateQueries({
                queryKey: ["participant", participant._id],
              });
            }
            if (e instanceof ApiError && e.status === 409)
              setConflict(e.details);
          }
        })}
      >
        <DocumentUpload
          kind="identity"
          disabled={form.formState.isSubmitting}
          allowSavedEdits={
            (form.watch("iin") || "") === (openedParticipant.current?.iin || "")
          }
          onBlocked={setBlocked}
          initialDocumentId={participant?.identityDocumentId || ""}
          onUploading={setUploading}
          onDocument={(id, previous) => {
            if (previous) {
              const changes = previousAttachmentChanges(
                "identity",
                previous,
                openedParticipant.current?.identityDocumentId,
                form.getValues(),
                manuallyEdited,
              );
              for (const key of changes.preserve)
                preservedIdentity.current.add(key);
              for (const key of Object.keys(changes.clear))
                form.setValue(key, "", { shouldValidate: true });
              autoFilled.current.clear();
            }
            form.setValue("identityDocumentId", id);
          }}
          onFields={applyIdentityFields}
        />
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
                placeholder={
                  key === "phone"
                    ? "+7 7__ ___ __ __"
                    : key === "middleName"
                      ? "Әкесінің аты көрсетілмеген"
                      : undefined
                }
                {...form.register(key)}
              />
            </Field>
          ))}
        </div>
        <details className="optional-fields">
          <summary>Есептегі аты-жөні</summary>
          <div className="form-grid">
            {[
              ["fullNameKk", "Қазақша аты-жөні"],
              ["fullNameRu", "Орысша аты-жөні"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                error={form.formState.errors[key]?.message as string}
              >
                <input maxLength={302} {...form.register(key)} />
              </Field>
            ))}
          </div>
        </details>
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
            Қуәлік жүктелсе, қайталануын тексеру үшін ЖСН міндетті. Автоматты
            оқылған мәліметті сақтамас бұрын тексеріңіз.
          </p>
          <div className="form-grid">
            {[...IDENTITY_FIELDS, ...OPTIONAL_IDENTITY_FIELDS]
              .filter(([key]) => !key.endsWith("Date"))
              .map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  error={form.formState.errors[key]?.message as string}
                >
                  <input
                    type="text"
                    required={
                      key === "iin" && !!form.watch("identityDocumentId")
                    }
                    inputMode={key === "iin" ? "numeric" : undefined}
                    maxLength={
                      key === "iin" ? 12 : key === "issuedBy" ? 200 : undefined
                    }
                    {...form.register(key)}
                  />
                </Field>
              ))}
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
        </section>
        <Field
          label="Ескертпе"
          error={form.formState.errors.notes?.message as string}
        >
          <textarea rows={4} maxLength={4000} {...form.register("notes")} />
        </Field>
        {conflict && <DuplicateNotice details={conflict} />}
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
            disabled={form.formState.isSubmitting}
          >
            Бас тарту
          </Button>
          <Button
            disabled={form.formState.isSubmitting || uploading || blocked}
          >
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
  initialCategory,
  onClose,
}: {
  participant: any;
  year: number;
  payment?: any;
  initialCategory?: { _id: string; name: string; amount: number };
  onClose: () => void;
}) {
  const [data, setData] = useState<any>({
    year,
    paymentCategoryId: initialCategory?._id || "",
    paymentCategoryName: initialCategory?.name,
    paymentKind: initialCategory ? "additional" : "membership",
    amount: payment
      ? String(payment.amount / 100)
      : initialCategory
        ? String(initialCategory.amount / 100)
        : "",
    paymentDate: today(),
    paymentTime: "",
    receiptType: "",
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
  const [textBlocked, setTextBlocked] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const touched = useRef(new Set<string>());
  const [fileNumber, setFileNumber] = useState("");
  const acceptedText = useRef({
    number: "",
    values: {} as Record<string, string | number>,
  });
  const savedTextOnly =
    !!payment?.receiptText &&
    !payment.receiptDocumentId &&
    data.receiptText === payment.receiptText &&
    !data.receiptDocumentId;
  const savedTextEvidence = useQuery({
    queryKey: ["saved-receipt-text", payment?._id, payment?.updatedAt],
    enabled: savedTextOnly,
    queryFn: ({ signal }) =>
      api("/receipts/recognize-text", {
        method: "POST",
        signal,
        body: JSON.stringify({
          text: payment.receiptText,
          paymentId: payment._id,
        }),
      }),
  });
  const mismatchMessage =
    "Файлдағы, мәтіндегі және төлемдегі чек нөмірі бірдей болуы керек. Мәтінді өшіріңіз немесе осы чектің мәтінін таңдаңыз.";
  const unchangedSources =
    data.receiptDocumentId === payment?.receiptDocumentId &&
    (data.receiptText || "") === (payment?.receiptText || "") &&
    receiptKey(data.receiptNumber) === receiptKey(payment?.receiptNumber);
  const fileMismatch = !!(
    data.receiptDocumentId &&
    data.receiptText &&
    !unchangedSources &&
    (!fileNumber ||
      fileNumber !== acceptedText.current.number ||
      fileNumber !== receiptKey(data.receiptNumber))
  );
  const textNumber =
    acceptedText.current.number ||
    (savedTextOnly
      ? receiptKey(savedTextEvidence.data?.fields?.receiptNumber)
      : "");
  const sourceMismatch =
    fileMismatch ||
    !!(
      data.receiptText &&
      !unchangedSources &&
      textNumber &&
      textNumber !== receiptKey(data.receiptNumber)
    );
  const clearRecognizedText = (preserveSavedCorrections = false) => {
    const clear: Record<string, string> = {};
    if (
      savedTextOnly &&
      !acceptedText.current.number &&
      savedTextEvidence.data?.fields
    ) {
      const changes = previousAttachmentChanges(
        "receipt",
        { id: payment._id, fields: savedTextEvidence.data.fields },
        payment._id,
        data,
        (key) => touched.current.has(key),
      );
      Object.assign(clear, changes.clear);
      if (preserveSavedCorrections)
        for (const key of changes.preserve) touched.current.add(key);
    }
    for (const [key, value] of Object.entries(acceptedText.current.values)) {
      if (data[key] === value && !touched.current.has(key)) clear[key] = "";
    }
    acceptedText.current = { number: "", values: {} };
    return clear;
  };
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [duplicate, setDuplicate] = useState<any>(null);
  const update = (key: string, value: any) => {
    setData((old: any) => ({ ...old, [key]: value }));
    touched.current.add(key);
    setDuplicate(null);
  };
  const applyReceiptFields = (
    fields: Record<string, string | number>,
    fillBlanksOnly = false,
  ) => {
    setData((old: any) => ({
      ...old,
      ...receiptAutofillUpdates(fields, old, touched.current, fillBlanksOnly),
    }));
    setDuplicate(null);
  };
  const save = async () => {
    if (uploading || readingText || blocked || textBlocked || sourceMismatch)
      return;
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
        },
        payment ? "PATCH" : "POST",
      );
      await queryClient.invalidateQueries();
      toast.success("Төлем сақталды.");
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setDuplicate(e.details);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={payment ? "Төлемді түзету" : "Төлем қосу"}
      description={`${participant.lastName} ${participant.firstName} · ${paymentCategoryLabel(data)}`}
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Чек түрі">
          <select
            value={data.receiptType}
            onChange={(e) => update("receiptType", e.target.value)}
            disabled={busy}
          >
            <option value="">Чек түрін таңдаңыз</option>
            {Object.entries(RECEIPT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <ReceiptTextInput
          key={data.receiptDocumentId || "no-file"}
          paymentId={payment?._id}
          onBlocked={setTextBlocked}
          initialText={data.receiptText}
          disabled={uploading || busy}
          onReading={setReadingText}
          onClear={() => {
            const clear = clearRecognizedText();
            setData((old: any) => ({ ...old, ...clear, receiptText: "" }));
            setDuplicate(null);
          }}
          onFields={(fields, text) => {
            const number = receiptKey(fields.receiptNumber);
            if (
              data.receiptDocumentId &&
              (!fileNumber ||
                fileNumber !== number ||
                fileNumber !== receiptKey(data.receiptNumber))
            )
              throw new Error(mismatchMessage);
            const clear = clearRecognizedText();
            const values = receiptAutofillUpdates(
              fields,
              { ...data, ...clear },
              touched.current,
              !!data.receiptDocumentId,
            );
            acceptedText.current = { number, values };
            setData((old: any) => ({
              ...old,
              ...clear,
              ...values,
              receiptText: text,
            }));
            setDuplicate(null);
          }}
        />
        <DocumentUpload
          kind="receipt"
          allowSavedEdits={unchangedSources}
          onBlocked={setBlocked}
          initialDocumentId={payment?.receiptDocumentId || ""}
          disabled={busy || readingText || savedTextEvidence.isLoading}
          replacingRecognizedText={!!data.receiptText}
          onUploading={setUploading}
          onDocument={(id, previous) => {
            if (id === data.receiptDocumentId) return;
            const fromText = clearRecognizedText(true);
            setFileNumber("");
            setTextBlocked(false);
            const changes =
              previous &&
              previousAttachmentChanges(
                "receipt",
                previous,
                payment?.receiptDocumentId,
                { ...data, ...fromText },
                (key) => touched.current.has(key),
              );
            for (const key of changes?.preserve || []) touched.current.add(key);
            setData((old: any) => ({
              ...old,
              ...fromText,
              ...changes?.clear,
              receiptText: "",
              receiptDocumentId: id,
            }));
            setDuplicate(null);
          }}
          onFields={(fields, fillBlanksOnly) => {
            setFileNumber(receiptKey(fields.receiptNumber));
            applyReceiptFields(fields, fillBlanksOnly);
          }}
        />
        <div className="form-grid">
          <Field label="Төленген сома, ₸ *">
            <input
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
          </Field>
          <Field label="Төлеген адам">
            <input
              value={data.payerName}
              onChange={(e) => update("payerName", e.target.value)}
              placeholder="Чектегі төлеушінің аты-жөні"
            />
          </Field>
          <Field label="Алушының атауы">
            <input
              value={data.recipientName}
              onChange={(e) => update("recipientName", e.target.value)}
            />
          </Field>
          <Field label="Чек нөмірі">
            <input
              required={!!data.receiptDocumentId || !!data.receiptText}
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
        {duplicate && <DuplicateNotice details={duplicate} />}
        {sourceMismatch && (
          <p className="field-error" role="alert">
            {fileMismatch
              ? mismatchMessage
              : "Төлемдегі чек нөмірі мәтіндегі чек нөміріне сәйкес келуі керек."}
          </p>
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
            disabled={busy}
            onClick={onClose}
          >
            Бас тарту
          </Button>
          <Button
            disabled={
              busy ||
              !!duplicate ||
              uploading ||
              readingText ||
              blocked ||
              textBlocked ||
              sourceMismatch
            }
          >
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
      description="Қатысушылардың мүшелік жарнасы мен қосымша төлемдерін «Төлем қосу» арқылы енгізіңіз."
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
