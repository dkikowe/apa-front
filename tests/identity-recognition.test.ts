import { describe, expect, it } from "vitest";
import { identityAutofillUpdates, missingDocumentFields } from "../shared/document-recognition";

describe("Identity recognition feedback and replacement", () => {
  it("does not report an identity complete without a full IIN", () => {
    for (const iin of [undefined,"","000123", "00012345O789"])
      expect(missingDocumentFields("identity",{iin,lastName:"Тест",firstName:"Үлгі",birthDate:"1975-04-15"})).toContain("ЖСН (12 сан)");
    expect(missingDocumentFields("identity",{iin:"000123456789",lastNameLatin:"TEST",firstNameLatin:"ULGI",birthDate:"1975-04-15"})).toEqual([]);
  });
  it("clears a previous scan's IIN when the next document does not supply one", () => {
    expect(identityAutofillUpdates({firstName:"Үлгі"},new Set(["iin","firstName"]),()=>false)).toEqual({iin:"",firstName:"Үлгі"});
  });
  it("preserves saved and manually corrected values and ignores unrecognized properties", () => {
    expect(identityAutofillUpdates({iin:"000123456789",phone:"bad",notes:"bad"},new Set(["iin"]),key=>key==="iin")).toEqual({});
    expect(identityAutofillUpdates({},new Set(),()=>false)).toEqual({});
  });
});
