import { describe, it, expect } from "vitest";
import {
  participantSchema,
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
