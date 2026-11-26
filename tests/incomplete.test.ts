import { describe, it, expect } from "vitest";
import {
  participantSchema,
  validIdentityIssuer,
  validityPeriod,
  missingParticipantFields,
  ageAt,
  ageGroup,
} from "../shared/domain.js";
describe("Incomplete participant profiles", () => {
  it("accepts missing data without inventing birthday, region, or phone", () => {
    const p = participantSchema.parse({ firstName: "Айша" });
    expect(p).toMatchObject({
      lastName: "",
      firstName: "Айша",
      birthDate: "",
      region: "",
      phone: "",
    });
    expect(missingParticipantFields(p)).toContain("Туған күні");
    expect(ageAt(p.birthDate)).toBeNaN();
    expect(ageGroup(ageAt(p.birthDate))).toBeNull();
  });
  it("removes incomplete status when profile fields are filled; patronymic and Latin names are optional", () => {
    const p = participantSchema.parse({
      lastName: "Сынақ",
      firstName: "Айша",
      birthDate: "1970-01-01",
      region: "Ақтау",
      phone: "+7 000 000 0001",
      iin: "000000000001",
      documentNumber: "TEST001",
      issuedBy: "Сынақ органы",
      issueDate: "2020-01-01",
      expiryDate: "2030-01-01",
    });
    expect(missingParticipantFields(p)).toEqual([]);
    expect(missingParticipantFields({ ...p, issuedBy: "" })).toEqual([
      "Кім берді",
    ]);
  });
  it("keeps validity headings and printed dates out of the issuing authority", () => {
    for (const issuedBy of [
      "Жарамдылық мерзімі",
      "Жарамдылык мерзими",
      "ҚОЛДАНЫЛУ МЕРЗІМІ / СРОК ДЕЙСТВИЯ",
      "02.05.2020 — 02.О5.2030 г.",
      "02.05.2020 - 02.05.2030",
      "Valid until",
    ]) {
      expect(validIdentityIssuer(issuedBy)).toBe(false);
      expect(
        participantSchema.safeParse({ firstName: "Айша", issuedBy }).success,
      ).toBe(false);
    }
    for (const issuedBy of [
      "ҚР ІШКІ ІСТЕР МИНИСТРЛІГІ",
      "МВД РК",
      "ГУ МВД № 2",
      "Regional Issuing Authority",
    ])
      expect(validIdentityIssuer(issuedBy)).toBe(true);
    expect(validityPeriod("2020-05-02", "2030-05-02")).toBe(
      "02.05.2020 — 02.05.2030",
    );
    expect(validityPeriod("Жарамдылық мерзімі", "2030-05-02")).toBe(
      "Көрсетілмеген — 02.05.2030",
    );
  });
  it("still rejects invalid supplied values and entirely blank cards", () => {
    for (const data of [
      {},
      { firstName: "Айша", birthDate: "2026-02-30" },
      { firstName: "Айша", phone: "bad" },
    ]) {
      expect(participantSchema.safeParse(data).success).toBe(false);
    }
  });
});
