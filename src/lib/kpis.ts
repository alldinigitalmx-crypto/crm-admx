// Funciones puras para /admin/kpis -- mismo patrón que reportes.ts y
// tareas-resumen.ts (sin JSX, testeable). Ninguna de estas cifras ya se
// muestra en Reportes ni en el Panel a propósito -- son un ángulo
// distinto (tamaño promedio de venta, qué tan bien se cierra, qué tan
// seguido regresa un cliente), no un resumen repetido de lo mismo.

export function promedio(valores: number[]): number {
  return valores.length ? valores.reduce((acc, v) => acc + v, 0) / valores.length : 0;
}

export type TicketPromedio = { promedio: number; count: number; excluidos: number };

/** Ticket promedio = tamaño promedio de los servicios nuevos del rango
 * (montoTotalServicio ya convertido a MXN por el caller, null cuando no
 * se pudo convertir -- ver resumirMontoMulti/obtenerTasasAMXN). Los que
 * no se pudieron convertir se cuentan aparte, nunca se fingen en 0. */
export function calcularTicketPromedio(montosMXN: (number | null)[]): TicketPromedio {
  const validos = montosMXN.filter((m): m is number => m !== null);
  return { promedio: promedio(validos), count: validos.length, excluidos: montosMXN.length - validos.length };
}

export type TasaConversion = { ganadas: number; total: number; pct: number };

/** % de cotizaciones emitidas en el rango que terminaron Firmada o
 * Pagada -- las Vencidas/Perdidas/todavía-Enviadas cuentan como no
 * ganadas. */
export function calcularTasaConversion(statuses: string[]): TasaConversion {
  const total = statuses.length;
  const ganadas = statuses.filter((s) => s === "Firmada" || s === "Pagada").length;
  return { ganadas, total, pct: total > 0 ? (ganadas / total) * 100 : 0 };
}

export type TiempoCierre = { dias: number; count: number };

/** Días promedio entre que se emite una cotización y se firma -- solo
 * cuenta las que sí llegaron a firmarse (fechaFirma no nula). */
export function calcularTiempoCierrePromedio(
  cotizaciones: { fechaEmision: Date; fechaFirma: Date | null }[]
): TiempoCierre {
  const cerradas = cotizaciones.filter(
    (c): c is { fechaEmision: Date; fechaFirma: Date } => c.fechaFirma !== null
  );
  if (cerradas.length === 0) return { dias: 0, count: 0 };
  const totalDias = cerradas.reduce(
    (acc, c) => acc + (c.fechaFirma.getTime() - c.fechaEmision.getTime()) / 86_400_000,
    0
  );
  return { dias: totalDias / cerradas.length, count: cerradas.length };
}

export type ClientesRecurrentes = { recurrentes: number; total: number; pct: number };

/** % de clientes (de siempre, no depende del rango de fechas -- igual
 * que "Pendiente por recibir" en Reportes) que ya tienen más de un
 * servicio -- una señal de qué tanto regresa la gente. */
export function calcularClientesRecurrentes(serviciosPorCliente: number[]): ClientesRecurrentes {
  const total = serviciosPorCliente.length;
  const recurrentes = serviciosPorCliente.filter((n) => n > 1).length;
  return { recurrentes, total, pct: total > 0 ? (recurrentes / total) * 100 : 0 };
}

export type TiempoDesarrollo = { dias: number; count: number };

/** Días promedio entre que arranca un servicio (fechaInicio) y se marca
 * Entregado (fechaFin) -- "qué tan rápido entrego un trabajo". */
export function calcularTiempoDesarrolloPromedio(
  servicios: { fechaInicio: Date; fechaFin: Date }[]
): TiempoDesarrollo {
  if (servicios.length === 0) return { dias: 0, count: 0 };
  const totalDias = servicios.reduce(
    (acc, s) => acc + (s.fechaFin.getTime() - s.fechaInicio.getTime()) / 86_400_000,
    0
  );
  return { dias: totalDias / servicios.length, count: servicios.length };
}

export type IngresoPorOrigen = { origen: string; montoMXN: number; count: number };

/** Cuánto se recaudó (neto, ya en MXN -- ver montoNetoEnMXN) según el
 * medioCaptacion del cliente detrás de cada pago -- "de dónde viene el
 * dinero que entra", no solo "cómo lo pagaron" (eso ya lo tiene
 * Reportes con Pagos por método). */
export function agruparIngresoPorOrigen(
  pagos: { montoMXN: number; origen: string | null }[]
): IngresoPorOrigen[] {
  const grupos = new Map<string, { monto: number; count: number }>();
  for (const p of pagos) {
    const key = p.origen ?? "Sin origen";
    const g = grupos.get(key) ?? { monto: 0, count: 0 };
    g.monto += p.montoMXN;
    g.count += 1;
    grupos.set(key, g);
  }
  return Array.from(grupos.entries())
    .map(([origen, g]) => ({ origen, montoMXN: g.monto, count: g.count }))
    .sort((a, b) => b.montoMXN - a.montoMXN);
}

export type TicketPorMes = { key: string; label: string; promedio: number; count: number };

const MES_CORTO_KPI = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Ticket promedio mes a mes dentro del rango -- a diferencia de
 * agruparRecaudadoGastos (reportes.ts), aquí siempre es por mes (nunca
 * por día): un "ticket promedio de hoy" no dice nada, y la pregunta que
 * de verdad importa es cómo se mueve mes a mes. */
export function agruparTicketPromedioPorMes(
  servicios: { fecha: Date; montoMXN: number | null }[],
  desde: Date,
  hasta: Date
): TicketPorMes[] {
  const grupos = new Map<string, { label: string; montos: number[] }>();
  const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  const limite = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), 1));
  let guard = 0;
  while (cursor.getTime() <= limite.getTime() && guard < 120) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = `${MES_CORTO_KPI[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(2)}`;
    grupos.set(key, { label, montos: [] });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard++;
  }
  for (const s of servicios) {
    if (s.montoMXN === null) continue;
    const key = `${s.fecha.getUTCFullYear()}-${String(s.fecha.getUTCMonth() + 1).padStart(2, "0")}`;
    const grupo = grupos.get(key);
    if (grupo) grupo.montos.push(s.montoMXN);
  }
  return Array.from(grupos.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, g]) => ({ key, label: g.label, promedio: promedio(g.montos), count: g.montos.length }));
}
