import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { money, parseMoney } from "../../../shared/domain";
import { api, send, queryClient } from "../api";
import { Field } from "./common";
import { Button } from "./ui/button";

type Category = { _id: string; name: string; amount: number };
export function usePaymentCategories() {
  return useQuery({
    queryKey: ["payment-categories"],
    queryFn: () => api<{ items: Category[] }>("/payment-categories"),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
}

export function PaymentCategorySelect({
  value,
  currentName,
  disabled,
  onChange,
  onEditing,
  onBusy,
}: {
  value: string;
  currentName?: string;
  disabled: boolean;
  onChange: (id: string, amount?: number, name?: string) => void;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const query = usePaymentCategories();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = query.data?.items || [];
  function edit(open: boolean) {
    setEditing(open);
    onEditing(open);
    setError("");
  }
  async function create() {
    let sum: number;
    try {
      sum = parseMoney(amount);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!name.trim() || !Number.isSafeInteger(sum) || sum <= 0) {
      setError("Төлемнің атауын және нөлден үлкен сомасын енгізіңіз.");
      return;
    }
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const created = (await send("/payment-categories", {
        name,
        amount: sum,
      })) as Category;
      queryClient.setQueryData<{ items: Category[] }>(
        ["payment-categories"],
        (old) => ({
          items: [
            ...(old?.items || []).filter((x) => x._id !== created._id),
            created,
          ],
        }),
      );
      onChange(created._id, created.amount, created.name);
      edit(false);
      setName("");
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["payment-categories"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section
      className="payment-category-section"
      aria-label="Төлем түрін таңдау"
    >
      <div className="payment-category-picker">
        <Field label="Төлем түрі">
          <select
            value={value}
            disabled={
              disabled || busy || editing || query.isLoading || query.isError
            }
            onChange={(e) => {
              const id = e.target.value;
              const selected = items.find((x) => x._id === id);
              onChange(id, selected?.amount, selected?.name);
            }}
          >
            <option value="">Төлемді таңдаңыз</option>
            {value && !items.some((x) => x._id === value) && (
              <option value={value}>{currentName || "Қосымша төлем"}</option>
            )}
            {items.map((x) => (
              <option key={x._id} value={x._id}>
                {x.name} · {money(x.amount)}
              </option>
            ))}
          </select>
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || editing}
          onClick={() => edit(true)}
        >
          <Plus size={20} /> Жаңа түр қосу
        </Button>
      </div>
      {query.isError && (
        <p className="field-error" role="alert">
          Төлем түрлері жүктелмеді.{" "}
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            Қайта көру
          </Button>
        </p>
      )}
      {editing && (
        <fieldset
          className="payment-category-editor"
          disabled={disabled || busy}
        >
          <legend>Жаңа төлем түрі</legend>
          <p className="small-note">
            Атауы мен сомасы барлық қатысушылардың таңдау тізімінде пайда
            болады. Бұл әрекет төлемді тіркемейді.
          </p>
          <div className="form-grid">
            <Field label="Төлем атауы">
              <input
                autoFocus
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Мысалы: Көрмеге қатысу"
              />
            </Field>
            <Field label="Сома, ₸">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="row-actions">
            <Button type="button" variant="outline" onClick={() => edit(false)}>
              Бас тарту
            </Button>
            <Button type="button" onClick={() => void create()}>
              {busy ? "Қосылуда…" : "Тізімге қосу"}
            </Button>
          </div>
        </fieldset>
      )}
      {!editing && value && (
        <p className="small-note">
          Бұл төлем мүшелік жарнадан бөлек есептеледі. Соманы нақты төлемге
          қарай өзгерте аласыз.
        </p>
      )}
    </section>
  );
}
