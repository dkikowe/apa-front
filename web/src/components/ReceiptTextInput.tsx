import { useRef, useState } from "react";
import { send } from "../api";
import { Field } from "./common";
import { Button } from "./ui/button";
export function ReceiptTextInput({
  initialText = "",
  paymentId,
  onBlocked,
  onClear,
  disabled,
  onReading,
  onFields,
}: {
  initialText?: string;
  paymentId?: string;
  onBlocked: (blocked: boolean) => void;
  onClear: () => void;
  disabled: boolean;
  onReading: (value: boolean) => void;
  onFields: (fields: Record<string, string | number>, text: string) => void;
}) {
  const callbacks = useRef({ onFields, onReading, onBlocked, onClear });
  callbacks.current = { onFields, onReading, onBlocked, onClear };
  const [text, setText] = useState(initialText),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  function changeText(value: string) {
    setText(value);
    setMessage("");
    callbacks.current.onBlocked(!!value.trim() && value !== initialText);
    if (!value.trim()) callbacks.current.onClear();
  }
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
          onChange={(e) => changeText(e.target.value)}
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
            callbacks.current.onFields(fields, text);
            callbacks.current.onBlocked(false);
            setMessage(
              fields.amount && fields.paymentDate
                ? "Мәтін оқылды. Төмендегі сома, күн және уақытты тексеріңіз."
                : "Чектің толық мәтінін көшіріп, қайта оқытыңыз.",
            );
          } catch (e) {
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
      {text && (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || busy}
          onClick={() => changeText("")}
        >
          Мәтінді өшіру
        </Button>
      )}
      <p className="small-note" role="status">
        {message ||
          (text.trim() && text !== initialText
            ? "«Мәтінді оқу» батырмасын басыңыз."
            : "Оқылған мәліметтерді тексеріп, «Төлемді сақтау» батырмасын басыңыз.")}
      </p>
    </details>
  );
}
