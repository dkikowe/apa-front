import { expect, it } from "vitest";
import { identityAutofillUpdates } from "../shared/document-recognition.js";

it.each([
  { issueDate: "2022-01-01", expiryDate: "" },
  { issueDate: "", expiryDate: "2009-12-31" },
])("keeps a manually saved date when combining it with OCR would reverse the validity range", (saved) => {
  const read = { issueDate: "2010-01-01", expiryDate: "2020-01-01", issuedBy: "МВД РК" };
  expect(identityAutofillUpdates(read, new Set(), () => false, saved)).toEqual({
    issuedBy: "МВД РК",
  });
});
