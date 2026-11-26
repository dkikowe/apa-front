import { expect, it } from "vitest";
import { receiptAutofillUpdates } from "../shared/document-recognition";

it("fills only blank fields of a saved payment, respecting corrections made during a receipt refresh", () => {
  const saved = { amount: "7000", payerName: "Түзетілген ат", recipientName: "", method: "", notes: "Ескертпе" };
  const read = { amount: 648700, payerName: "Чектегі ат", recipientName: "Сынақ А.", method: "Аударым", notes: "Басқа мәтін" };
  expect(receiptAutofillUpdates(read, saved, new Set(["method"]), true)).toEqual({ recipientName: "Сынақ А." });
});

it("replacing a receipt replaces untouched fields, including clearing values absent from the new receipt", () => {
  const updates = receiptAutofillUpdates({ amount: 648700, recipientName: "Сынақ А." }, { method: "Ескі әдіс" }, new Set(["payerName"]), false);
  expect(updates).toMatchObject({amount:"6487", recipientName:"Сынақ А.",method:""});
  expect(updates).not.toHaveProperty("payerName");
});
