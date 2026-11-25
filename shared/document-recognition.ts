import { IDENTITY_FIELDS } from "./domain.js";

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
    return missing;
  }
  return Object.entries({
    amount: "сома",
    paymentDate: "күн",
    paymentTime: "уақыт",
    receiptNumber: "чек нөмірі",
    recipientName: "алушы",
    method: "төлем тәсілі",
  })
    .filter(([key]) => !fields[key])
    .map(([, label]) => label);
}
