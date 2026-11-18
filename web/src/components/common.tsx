import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileDown,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  AGE_LABELS,
  REGIONS,
  STATUS_LABELS,
  today,
} from "../../../shared/domain";
import { downloadReport } from "../api";
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || "Мәліметтерді тексеріп, сақтаңыз."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Терезені жабу">
                <X size={22} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Confirm({
  title,
  description,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      description={description}
      onClose={() => !busy && onClose()}
    >
      <div className="modal-actions">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Бас тарту
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Күте тұрыңыз…" : "Иә, растаймын"}
        </Button>
      </div>
    </Modal>
  );
}
export function Status({ status }: { status: keyof typeof STATUS_LABELS }) {
  return (
    <span className={`status ${status}`}>
      {status === "paid" ? (
        <Check size={14} />
      ) : (
        <span className="status-dot" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}
export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={22} />
      <div>
        <strong>
          {error instanceof Error ? error.message : "Байланыс үзілді."}
        </strong>
        <p>Интернет байланысын тексеріп, қайталап көріңіз.</p>
        {retry && (
          <Button variant="outline" onClick={retry}>
            Қайта көру
          </Button>
        )}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-wrap" role="status" aria-label="Жүктелуде">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export const defaultFilters = {
  year: Number(today().slice(0, 4)),
  q: "",
  region: "",
  age: "",
  status: "",
  archived: "false",
  sort: "name",
  direction: "asc",
};
export type FilterState = typeof defaultFilters;
export function YearSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const current = Number(today().slice(0, 4));
  return (
    <select
      aria-label="Есеп жылы"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {Array.from(
        { length: current - 1999 + 2 },
        (_, i) => current + 2 - i,
      ).map((y) => (
        <option key={y} value={y}>
          {y} жыл
        </option>
      ))}
    </select>
  );
}
export function Filters({
  value,
  onChange,
  year = true,
}: {
  value: FilterState;
  onChange: (v: FilterState) => void;
  year?: boolean;
}) {
  return (
    <div className="filters">
      {year && (
        <Field label="Жыл">
          <YearSelect
            value={value.year}
            onChange={(v) => onChange({ ...value, year: v })}
          />
        </Field>
      )}
      <Field label="Аймақ">
        <select
          value={value.region}
          onChange={(e) => onChange({ ...value, region: e.target.value })}
        >
          <option value="">Барлық аймақ</option>
          {REGIONS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Жасы">
        <select
          value={value.age}
          onChange={(e) => onChange({ ...value, age: e.target.value })}
        >
          <option value="">Барлық жас</option>
          {AGE_LABELS.map((x, i) => (
            <option key={x} value={i}>
              {x}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Төлем жағдайы">
        <select
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">Барлығы</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      {(value.region || value.age || value.status || value.q) && (
        <Button
          variant="ghost"
          onClick={() => onChange({ ...defaultFilters, year: value.year })}
        >
          Тазарту
        </Button>
      )}
    </div>
  );
}
export function Pagination({
  page,
  total,
  limit = 20,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total} жазба`
          : "0 жазба"}
      </span>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Алдыңғы бет"
        >
          <ChevronLeft size={18} />
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Келесі бет"
        >
          <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  );
}
export function ExportButton({
  type = "members",
  filters,
  label = "Excel жүктеу",
}: {
  type?: string;
  filters: Record<string, any>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadReport(type, filters);
          toast.success("Есеп жүктелді");
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <LoaderCircle className="spin" size={18} />
      ) : (
        <FileDown size={18} />
      )}{" "}
      {busy ? "Дайындалуда…" : label}
    </Button>
  );
}
export function Empty({
  title = "Әзірге жазба жоқ",
  description = "Алғашқы жазбаны қосқаннан кейін осы жерде көрінеді.",
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">✧</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
