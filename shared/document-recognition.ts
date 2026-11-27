import { IDENTITY_FIELDS, invalidIdentityFields } from "./domain.js";

export const RECEIPT_RECOGNITION_VERSION = 9;
export const IDENTITY_RECOGNITION_VERSION = 9;

export const receiptKey = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFKC").replace(/\s/g, "").toUpperCase()
    : "";

export const IDENTITY_OCR_FIELDS = [
  "lastName",
  "firstName",
  "middleName",
  "lastNameLatin",
  "firstNameLatin",
  "birthDate",
  ...IDENTITY_FIELDS.map(([key]) => key),
] as const;

// Only clear values filled by a previous scan. Keep saved/manual form values.
export function identityAutofillUpdates(
  fields: Record<string, unknown>,
  previous: ReadonlySet<string>,
  isDirty: (key: string) => boolean,
  saved?: Record<string, unknown>,
) {
  const updates: Record<string, string> = {};
  const invalid = invalidIdentityFields(fields);
  const invalidSaved = invalidIdentityFields(saved ?? {});
  for (const key of IDENTITY_OCR_FIELDS) {
    if (isDirty(key)) continue;
    if (saved?.[key] && !invalidSaved.has(key)) continue;
    if (typeof fields[key] === "string" && !invalid.has(key))
      updates[key] = fields[key];
    else if (previous.has(key) || invalidSaved.has(key)) updates[key] = "";
  }
  // A valid range read from the card can conflict with a manually entered
  // endpoint. Preserve that endpoint without applying an impossible range.
  if (saved && (updates.issueDate || updates.expiryDate)) {
    const merged = invalidIdentityFields({ ...saved, ...updates });
    for (const key of ["issueDate", "expiryDate"])
      if (merged.has(key) && updates[key]) delete updates[key];
  }
  return updates;
}

// A replacement receipt refreshes all untouched OCR fields. When reopening a
// saved payment, only use its attachment to fill gaps in the saved values.
export function receiptAutofillUpdates(
  fields: Record<string, string | number>,
  current: Record<string, unknown>,
  touched: ReadonlySet<string>,
  fillBlanksOnly: boolean,
) {
  const updates: Record<string, string | number> = {};
  for (const key of [
    "amount",
    "paymentDate",
    "paymentTime",
    "recipientName",
    "payerName",
    "receiptNumber",
    "method",
    "receiptType",
  ]) {
    if (
      touched.has(key) ||
      (fillBlanksOnly && String(current[key] ?? "").trim())
    )
      continue;
    const value = fields[key];
    if (value == null && fillBlanksOnly) continue;
    updates[key] =
      value == null
        ? ""
        : key === "amount"
          ? String(Number(value) / 100)
          : value;
  }
  return updates;
}

export function missingDocumentFields(
  kind: "identity" | "receipt",
  fields: Record<string, unknown>,
) {
  if (kind === "identity") {
    const missing: string[] = [];
    const invalid = invalidIdentityFields(fields);
    if (typeof fields.iin !== "string" || !/^\d{12}$/.test(fields.iin))
      missing.push("ЖСН (12 сан)");
    const hasCyrillic = (value: unknown) =>
      typeof value === "string" && /\p{Script=Cyrillic}/u.test(value);
    const expectsCyrillicNames = [
      fields.lastName,
      fields.firstName,
      invalid.has("issuedBy") ? undefined : fields.issuedBy,
    ].some(hasCyrillic);
    for (const [key, label] of [
      ["lastName", "тегі"],
      ["firstName", "аты"],
    ]) {
      const hasName = expectsCyrillicNames
        ? hasCyrillic(fields[key])
        : fields[key] || fields[key + "Latin"];
      if (!hasName) missing.push(label);
    }
    if (!fields.birthDate) missing.push("туған күні");
    for (const [key, label] of Object.entries({
      documentNumber: "куәлік нөмірі",
      issuedBy: "кім берді",
      issueDate: "берілген күні",
      expiryDate: "жарамдылық мерзімі",
      lastNameLatin: "латынша тегі",
      firstNameLatin: "латынша аты",
    }))
      if (!fields[key] || invalid.has(key)) missing.push(label);
    // A patronymic can genuinely be absent from an identity card.
    return missing;
  }
  return Object.entries({
    amount: "сома",
    paymentDate: "күн",
    paymentTime: "уақыт",
    receiptNumber: "чек нөмірі",
    recipientName: "алушы",
    payerName: "төлем жасаған адам",
    method: "төлем тәсілі",
  })
    .filter(([key]) => !fields[key])
    .map(([, label]) => label);
}
