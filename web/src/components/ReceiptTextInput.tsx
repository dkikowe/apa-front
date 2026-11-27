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
  async function readText(value: string) {
    if (!value.trim() || busy || disabled) return;
    setBusy(true);
    callbacks.current.onReading(true);
    setMessage("");
    try {
      const { fields } = await send("/receipts/recognize-text", {
        text: value,
        paymentId,
      });
      callbacks.current.onFields(fields, value);
      callbacks.current.onBlocked(false);
      setMessage(
        fields.amount && fields.paymentDate
          ? "Чек оқылды. Төлемді тексеріп, «Төлемді сақтау» батырмасын басыңыз."
          : "Чектің толық мәтінін көшіріп, қайта оқытыңыз.",
      );
    } catch (e) {
      callbacks.current.onBlocked(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      callbacks.current.onReading(false);
    }
  }
  return (
    <div className="receipt-text-input">
      <Field label="WhatsApp-тағы чек мәтінін қойыңыз">
        <textarea
          rows={3}
          maxLength={20000}
          value={text}
          disabled={busy || disabled}
          onChange={(event) => {
            const value = event.currentTarget.value;
            changeText(value);
            if (
              (event.nativeEvent as InputEvent).inputType === "insertFromPaste"
            )
              void readText(value);
          }}
        />
      </Field>
      {text.trim() && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy}
            onClick={() => void readText(text)}
          >
            {busy ? "Оқылуда…" : "Мәтінді оқу"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => changeText("")}
          >
            Мәтінді өшіру
          </Button>
        </>
      )}
      <p className="small-note" role="status">
        {busy
          ? "Чек оқылуда…"
          : message ||
            (text.trim() && text !== initialText
              ? "«Мәтінді оқу» батырмасын басыңыз."
              : "")}
      </p>
    </div>
  );
}
