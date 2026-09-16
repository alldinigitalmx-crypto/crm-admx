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

const DIA_MS = 24 * 60 * 60 * 1000;

// Fecha relativa corta ("hoy", "ayer", "hace 3 semanas") para listas donde
// importa más el "qué tan reciente" que la fecha exacta -- ej. última
// actividad de un cliente. Redondea hacia abajo (trunca), así que "hace 1
// semana" es de 7 a 13 días, no de 4 a 10.
export function formatRelativeDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const dias = Math.floor((Date.now() - new Date(value).getTime()) / DIA_MS);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return `hace ${semanas} semana${semanas === 1 ? "" : "s"}`;
  }
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return `hace ${meses} mes${meses === 1 ? "" : "es"}`;
  }
  const anios = Math.floor(dias / 365);
  return `hace ${anios} año${anios === 1 ? "" : "s"}`;
}
