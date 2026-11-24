type PaymentMoment = {
  paymentDate: string;
  paymentTime?: string;
  createdAt?: string;
  _id?: string;
};
export function sortPayments<T extends PaymentMoment>(
  payments: T[],
  direction: "asc" | "desc",
) {
  const sign = direction === "asc" ? 1 : -1;
  return [...payments].sort((a, b) => {
    const date = a.paymentDate.localeCompare(b.paymentDate);
    if (date) return date * sign;
    // Unknown time stays last within its day; it is not treated as midnight.
    if (!!a.paymentTime !== !!b.paymentTime) return a.paymentTime ? -1 : 1;
    const time = (a.paymentTime || "")
      .padEnd(8, ":00")
      .localeCompare((b.paymentTime || "").padEnd(8, ":00"));
    return (
      time * sign ||
      (a.createdAt || "").localeCompare(b.createdAt || "") * sign ||
      (a._id || "").localeCompare(b._id || "")
    );
  });
}
