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

// Formato "en-US" (coma de miles, punto decimal) igual que USD, no el
// europeo ("1.234,56 €") -- así el separador decimal no cambia de
// significado entre monedas dentro de la misma app.
const currencyFormatterEUR = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// La app es mayormente MXN — por eso ese caso no lleva sufijo (se ve igual
// que siempre). El resto sí lleva su código explícito al final: USD/COP
// para no confundirlos con MXN (los tres usan el símbolo "$"), y EUR por
// consistencia con los demás aunque su símbolo "€" ya sea inconfundible.
export function formatCurrency(
  value: number | string | { toString(): string },
  moneda?: string | null
) {
  if (moneda === "USD") return `${currencyFormatterUSD.format(Number(value))} USD`;
  if (moneda === "COP") return `${currencyFormatterCOP.format(Number(value))} COP`;
  if (moneda === "EUR") return `${currencyFormatterEUR.format(Number(value))} EUR`;
  return currencyFormatterMXN.format(Number(value));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}
