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
