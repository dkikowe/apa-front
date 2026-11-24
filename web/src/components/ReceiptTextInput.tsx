import { useRef, useState } from "react";
import { send } from "../api";
import { Field } from "./common";
import { Button } from "./ui/button";
export function ReceiptTextInput({
  initialText = "",
  disabled,
  onReading,
  onFields,
}: {
  initialText?: string;
  disabled: boolean;
  onReading: (value: boolean) => void;
  onFields: (fields: Record<string, string | number>, text: string) => void;
}) {
  const callbacks = useRef({ onFields, onReading });
  callbacks.current = { onFields, onReading };
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
            const { fields } = await send("/receipts/recognize-text", { text });
            callbacks.current.onFields(fields, text);
            setMessage(
              fields.amount && fields.paymentDate
                ? "Мәтін оқылды. Төмендегі сома, күн және уақытты тексеріңіз."
                : "Мәтін толық оқылмады. Жетіспейтін мәліметтерді қолмен толтырыңыз.",
            );
          } catch (e) {
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
