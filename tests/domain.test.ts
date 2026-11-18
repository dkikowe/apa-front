import { describe, it, expect } from "vitest";
import {
  ageAt,
  ageGroup,
  balance,
  FEE,
  parseMoney,
  participantSchema,
} from "../shared/domain.js";
describe("Age and money", () => {
  it("calculates age on the birthday, not by a stored value", () => {
    expect(ageAt("2000-11-19", "2026-11-18")).toBe(25);
    expect(ageAt("2000-11-18", "2026-11-18")).toBe(26);
    expect(ageAt("2000-02-29", "2025-02-28")).toBe(24);
    expect(ageAt("2000-02-29", "2025-03-01")).toBe(25);
  });
  it.each([
    [24, 0],
    [25, 1],
    [44, 1],
    [45, 2],
    [64, 2],
    [65, 3],
    [90, 3],
  ])("groups age %i into %i", (age, group) =>
    expect(ageGroup(age)).toBe(group),
  );
  it("handles partial, full, zero and overpayments exactly in tiyn", () => {
    expect(balance(109000)).toMatchObject({
      remaining: 539700,
      status: "partial",
    });
    expect(balance(109000 + 539700)).toMatchObject({
      remaining: 0,
      status: "paid",
    });
    expect(balance(700000)).toMatchObject({
      overpayment: 51300,
      progress: 100,
    });
    expect(balance(0)).toMatchObject({ remaining: FEE, status: "unpaid" });
  });
  it("parses money without floating-point multiplication", () => {
    expect(parseMoney("6 487,15")).toBe(648715);
    expect(parseMoney("0.29")).toBe(29);
    expect(() => parseMoney("1.001")).toThrow();
    expect(() => parseMoney("-15")).toThrow();
  });
  it("rejects invalid calendar dates and future birthdays", () => {
    expect(
      participantSchema.safeParse({
        lastName: "Test",
        firstName: "Example",
        birthDate: "2026-02-30",
        region: "Ақтау",
        phone: "+70000000000",
      }).success,
    ).toBe(false);
  });
});
