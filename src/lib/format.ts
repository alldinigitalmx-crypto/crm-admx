const currencyFormatterMXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const currencyFormatterUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const currencyFormatterCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// La app es mayormente MXN — por eso ese caso no lleva sufijo (se ve igual
// que siempre). USD y COP sí llevan su código explícito al final para no
// confundirlos con MXN, ya que los tres usan el símbolo "$".
export function formatCurrency(
  value: number | string | { toString(): string },
  moneda?: string | null
) {
  if (moneda === "USD") return `${currencyFormatterUSD.format(Number(value))} USD`;
  if (moneda === "COP") return `${currencyFormatterCOP.format(Number(value))} COP`;
  return currencyFormatterMXN.format(Number(value));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}
