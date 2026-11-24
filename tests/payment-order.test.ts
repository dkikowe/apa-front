import { expect, it } from "vitest";
import { sortPayments } from "../shared/payment-order";
it("sorts payment dates and times in both directions without mutating the source; unknown times stay last within the day", () => {
  const rows = [
    {_id: "late", paymentDate: "2026-10-02", paymentTime: "15:30:01"},
    {_id: "older", paymentDate: "2026-10-01", paymentTime: "23:59"},
    {_id: "unknown", paymentDate: "2026-10-02", paymentTime: ""},
    {_id: "early", paymentDate: "2026-10-02", paymentTime: "09:30"},
    {_id: "minute", paymentDate: "2026-10-02", paymentTime: "15:30"},
  ];
  expect(sortPayments(rows, "desc").map(x => x._id)).toEqual(["late", "minute", "early", "unknown", "older"]);
  expect(sortPayments(rows, "asc").map(x => x._id)).toEqual(["older", "early", "minute", "late", "unknown"]);
  expect(rows[0]._id).toBe("late");
});
