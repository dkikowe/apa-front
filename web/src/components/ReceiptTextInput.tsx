import { useRef, useState } from "react";
import { send, ApiError } from "../api";
import { Field } from "./common";
import { Button } from "./ui/button";
export function ReceiptTextInput({
  initialText = "",
  paymentId,
  onBlocked,
  disabled,
  onReading,
  onFields,
}: {
  initialText?: string;
  paymentId?: string;
  onBlocked: (blocked: boolean) => void;
  disabled: boolean;
  onReading: (value: boolean) => void;
  onFields: (fields: Record<string, string | number>, text: string) => void;
}) {
  const callbacks = useRef({ onFields, onReading, onBlocked });
  callbacks.current = { onFields, onReading, onBlocked };
  const [text, setText] = useState(initialText),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <details className="optional-fields" open={initialText ? true : undefined}>
      <summary>Чек WhatsApp-та мәтінмен келді ме?</summary>
      <Field label="Чек мәтіні">
        <textarea
          rows={6}
          maxLength={20000}
          value={text}
          disabled={busy || disabled}
          placeholder="WhatsApp-тағы чектің мәтінін көшіріп, осында қойыңыз."
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value.trim()) callbacks.current.onBlocked(false);
            setMessage("");
          }}
        />
      </Field>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          callbacks.current.onReading(true);
          setMessage("");
          try {
            const { fields } = await send("/receipts/recognize-text", {
              text,
              paymentId,
            });
            callbacks.current.onBlocked(false);
            callbacks.current.onFields(fields, text);
            setMessage(
              fields.amount && fields.paymentDate
                ? "Мәтін оқылды. Төмендегі сома, күн және уақытты тексеріңіз."
                : "Чектің толық мәтінін көшіріп, қайта оқытыңыз.",
            );
          } catch (e) {
            if (e instanceof ApiError && e.status === 409)
              callbacks.current.onBlocked(true);
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
            callbacks.current.onReading(false);
          }
        }}
      >
        {busy ? "Оқылуда…" : "Мәтінді оқу"}
      </Button>
      <p className="small-note" role="status">
        {message ||
          "Оқылған мәліметтерді тексеріп, «Төлемді сақтау» батырмасын басыңыз."}
      </p>
    </details>
  );
}
