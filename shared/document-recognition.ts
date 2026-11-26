import { IDENTITY_FIELDS } from "./domain.js";

export const RECEIPT_RECOGNITION_VERSION = 3;
export const IDENTITY_RECOGNITION_VERSION = 3;

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
) {
  const updates: Record<string, string> = {};
  for (const key of IDENTITY_OCR_FIELDS) {
    if (isDirty(key)) continue;
    if (typeof fields[key] === "string") updates[key] = fields[key];
    else if (previous.has(key)) updates[key] = "";
  }
  return updates;
}

export function missingDocumentFields(
  kind: "identity" | "receipt",
  fields: Record<string, unknown>,
) {
  if (kind === "identity") {
    const missing: string[] = [];
    if (typeof fields.iin !== "string" || !/^\d{12}$/.test(fields.iin))
      missing.push("ЖСН (12 сан)");
    if (!fields.lastName && !fields.lastNameLatin) missing.push("тегі");
    if (!fields.firstName && !fields.firstNameLatin) missing.push("аты");
    if (!fields.birthDate) missing.push("туған күні");
    for (const [key, label] of Object.entries({
      documentNumber: "куәлік нөмірі",
      issuedBy: "кім берді",
      issueDate: "берілген күні",
      expiryDate: "жарамдылық мерзімі",
      lastNameLatin: "латынша тегі",
      firstNameLatin: "латынша аты",
    }))
      if (!fields[key]) missing.push(label);
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
