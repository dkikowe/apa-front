import { z } from "zod";
export const REGIONS = [
  "Ақтау",
  "Жаңаөзен",
  "Бейнеу ауданы",
  "Қарақия ауданы",
  "Маңғыстау ауданы",
  "Мұнайлы ауданы",
  "Түпқараған ауданы",
] as const;
export const AGE_LABELS = [
  "25 жас және одан төмен",
  "26–45 жас",
  "46–65 жас",
  "66 жас және одан жоғары",
] as const;
export const RECEIPT_TYPES = {
  personal: "Жеке",
  urshyk: "ОО Ремесленников «URSHYK»",
} as const;
export const FEE = 648700; // tiyn, never binary floating point money
export const STATUS_LABELS = {
  unpaid: "Төленбеген",
  partial: "Ішінара төленген",
  paid: "Төленген",
} as const;
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function ageAt(birthDate: string, at = today()) {
  if (!birthDate) return NaN;
  const [y, m, d] = birthDate.slice(0, 10).split("-").map(Number);
  const [ay, am, ad] = at.split("-").map(Number);
  return ay - y - (am < m || (am === m && ad < d) ? 1 : 0);
}
export function ageGroup(age: number) {
  if (!Number.isFinite(age)) return null;
  return age < 26 ? 0 : age < 46 ? 1 : age < 66 ? 2 : 3;
}
export function balance(paid: number) {
  return {
    totalPaid: paid,
    remaining: Math.max(0, FEE - paid),
    overpayment: Math.max(0, paid - FEE),
    status: paid === 0 ? "unpaid" : paid < FEE ? "partial" : "paid",
    progress: Math.min(100, (paid / FEE) * 100),
  };
}
export function money(value: number) {
  const absolute = Math.abs(value);
  const major = String(Math.floor(absolute / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "\u202f",
  );
  const minor = absolute % 100;
  return (
    (value < 0 ? "−" : "") +
    major +
    (minor ? "," + String(minor).padStart(2, "0") : "") +
    " ₸"
  );
}
export function displayDate(value = today()) {
  const months = [
    "қаңтар",
    "ақпан",
    "наурыз",
    "сәуір",
    "мамыр",
    "маусым",
    "шілде",
    "тамыз",
    "қыркүйек",
    "қазан",
    "қараша",
    "желтоқсан",
  ];
  const [, month, day] = value.split("-").map(Number);
  return `${day} ${months[month - 1]}`;
}
export function parseMoney(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(cleaned))
    throw new Error("Соманы дұрыс енгізіңіз");
  const [major, minor = ""] = cleaned.split(".");
  return Number(major) * 100 + Number(minor.padEnd(2, "0"));
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Күнді көрсетіңіз")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Күн дұрыс емес",
  );
const name = z.string().trim().min(1, "Бұл жолды толтырыңыз").max(100);
export const IDENTITY_FIELDS = [
  ["iin", "ЖСН (12 сан)"],
  ["documentNumber", "Куәлік нөмірі"],
  ["issuedBy", "Кім берді"],
  ["issueDate", "Жарамдылық мерзімінің басталуы"],
  ["expiryDate", "Жарамдылық мерзімінің аяқталуы"],
] as const;
export function validityPeriod(start?: string, end?: string) {
  const date = (value?: string) =>
    value ? value.split("-").reverse().join(".") : "Көрсетілмеген";
  return `${date(start)} — ${date(end)}`;
}
export const paymentTimeSchema = z
  .string()
  .regex(/^(?:([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)?$/, "Уақытты тексеріңіз")
  .default("");
const optionalDate = z.union([dateSchema, z.literal("")]).default("");
export const participantSchema = z
  .object({
    lastName: z.string().trim().max(100).default(""),
    firstName: z.string().trim().max(100).default(""),
    notes: z.string().trim().max(4000).default(""),
    village: z.string().trim().max(200).default(""),
    middleName: z.string().trim().max(100).default(""),
    lastNameLatin: z.string().trim().max(100).default(""),
    firstNameLatin: z.string().trim().max(100).default(""),
    birthDate: z
      .union([
        dateSchema.refine(
          (v) => v <= today() && ageAt(v) <= 120,
          "Туған күнін тексеріңіз",
        ),
        z.literal(""),
      ])
      .default(""),
    region: z
      .union([z.enum(REGIONS, { error: "Аймақты таңдаңыз" }), z.literal("")])
      .default(""),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+?[\d\s()-]{10,20})?$/, "Телефон нөмірін тексеріңіз")
      .default(""),
    iin: z
      .string()
      .trim()
      .regex(/^(?:\d{12})?$/, "ЖСН 12 саннан тұруы керек")
      .default(""),
    documentNumber: z
      .string()
      .trim()
      .max(30)
      .regex(/^[A-Za-zА-Яа-я0-9 -]*$/, "Куәлік нөмірін тексеріңіз")
      .default(""),
    issuedBy: z.string().trim().max(200).default(""),
    issueDate: optionalDate,
    expiryDate: optionalDate,
    identityDocumentId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
  })
  .refine(
    (v) =>
      Boolean(
        v.lastName || v.firstName || v.phone || v.iin || v.documentNumber,
      ),
    {
      message: "Кемінде аты-жөнін, телефонды немесе құжат нөмірін енгізіңіз",
      path: ["lastName"],
    },
  )
  .refine((v) => !v.issueDate || !v.expiryDate || v.issueDate <= v.expiryDate, {
    message: "Жарамдылық мерзімінің аяқталуы басталуынан бұрын болмауы керек",
    path: ["expiryDate"],
  });
export const MEMBERSHIP_PAYMENT_LABEL = "Мүшелік жарна";
export function paymentCategoryLabel(payment: {
  paymentKind?: string | null;
  paymentCategoryName?: string | null;
}) {
  return payment.paymentKind === "additional"
    ? payment.paymentCategoryName || "Қосымша төлем"
    : MEMBERSHIP_PAYMENT_LABEL;
}
export const paymentCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.number().int().positive().max(1000000000000),
});
export const paymentSchema = z.object({
  paymentCategoryId: z
    .union([z.literal(""), z.string().regex(/^[a-f\d]{24}$/i)])
    .optional(),
  year: z.number().int().min(2000).max(2100),
  amount: z.number().int().positive().max(1000000000000),
  paymentDate: dateSchema,
  paymentTime: paymentTimeSchema,
  receiptType: z.enum(["", "personal", "urshyk"]).default(""),
  receiptText: z.string().max(20000).default(""),
  recipientName: z.string().trim().max(200).default(""),
  payerName: z.string().trim().max(200).default(""),
  receiptNumber: z.string().trim().max(150).default(""),
  method: z.string().trim().max(100).default(""),
  receiptDocumentId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  notes: z.string().trim().max(1000).default(""),
});
export const financeSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().int().positive().max(1000000000000),
  date: dateSchema,
  category: name,
  description: z.string().trim().max(1000).default(""),
});
export type ParticipantInput = z.infer<typeof participantSchema>;

// Patronymic, Latin spelling and attachment are optional; missing profile data
// is shown separately from the participant's payment status.
export const PROFILE_FIELDS = [
  ["lastName", "Тегі"],
  ["firstName", "Аты"],
  ["birthDate", "Туған күні"],
  ["region", "Аймақ"],
  ["phone", "Телефон"],
  ...IDENTITY_FIELDS,
] as const;
export function missingParticipantFields(p: Partial<ParticipantInput>) {
  return PROFILE_FIELDS.filter(([key]) => !p[key]?.trim()).map(
    ([, label]) => label,
  );
}
