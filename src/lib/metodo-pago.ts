// Etiquetas legibles para el enum MetodoPago — se comparte entre
// /admin/reportes y las tarjetas móviles de /admin/pagos para no
// duplicar el mapeo.
export const METODO_LABEL: Record<string, string> = {
  Efectivo: "Efectivo",
  Transferencia: "Transferencia",
  MercadoPago: "Mercado Pago",
  PayPal: "PayPal",
  Tarjeta: "Tarjeta",
  WesternUnion: "Western Union",
  Binance: "Binance",
  Deposito: "Depósito",
  Spin: "Spin by OXXO",
  Otro: "Otro",
};
