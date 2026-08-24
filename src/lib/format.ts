const currencyFormatterMXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const currencyFormatterUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// La app es mayormente MXN — por eso ese caso no lleva sufijo (se ve igual
// que siempre). USD sí lleva "USD" explícito al final para no confundirlo
// con MXN, ya que ambos usan el símbolo "$".
export function formatCurrency(
  value: number | string | { toString(): string },
  moneda?: string | null
) {
  if (moneda === "USD") return `${currencyFormatterUSD.format(Number(value))} USD`;
  return currencyFormatterMXN.format(Number(value));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}
