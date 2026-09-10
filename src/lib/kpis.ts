// Funciones puras para /admin/kpis -- mismo patrón que reportes.ts y
// tareas-resumen.ts (sin JSX, testeable). Ninguna de estas cifras ya se
// muestra en Reportes ni en el Panel a propósito -- son un ángulo
// distinto (tamaño promedio de venta, qué tan bien se cierra, qué tan
// seguido regresa un cliente), no un resumen repetido de lo mismo.

export function promedio(valores: number[]): number {
  return valores.length ? valores.reduce((acc, v) => acc + v, 0) / valores.length : 0;
}

/** La mediana (a diferencia del promedio) no se deja arrastrar por un
 * solo contrato gigante metido en una muestra chica -- con 5-6 servicios
 * nuevos al mes (el caso típico), un solo trato grande puede triplicar
 * el promedio y dar una cifra que no representa "un trato normal" de
 * ese mes. La mediana sí. */
export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 !== 0
    ? ordenados[mitad]
    : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

export type ResumenTicket = {
  mediana: number;
  promedio: number;
  min: number;
  max: number;
  count: number;
};

/** Ticket típico = lo que de verdad se ha pagado por cada servicio nuevo
 * del rango (suma de sus pagos confirmados, ya en MXN -- ver montoEnMXN).
 * Devuelve mediana Y promedio Y rango en una sola pasada: la mediana es
 * la cifra "de un trato normal" (un contrato gigante no la dispara), el
 * promedio dice cuánto entra en promedio por trato, y min/max muestran
 * qué tan disparejos son. */
export function resumenTicket(montosMXN: number[]): ResumenTicket {
  return {
    mediana: mediana(montosMXN),
    promedio: promedio(montosMXN),
    min: montosMXN.length ? Math.min(...montosMXN) : 0,
    max: montosMXN.length ? Math.max(...montosMXN) : 0,
    count: montosMXN.length,
  };
}

export type ResumenPromedioMediana = { promedio: number; mediana: number; count: number };

/** De "cuánto pagó cada cliente en el rango", su promedio y su mediana --
 * "cuánto deja un cliente". El promedio se infla con un cliente enorme;
 * la mediana dice el caso típico. */
export function calcularIngresoPorCliente(montosPorClienteMXN: number[]): ResumenPromedioMediana {
  return {
    promedio: promedio(montosPorClienteMXN),
    mediana: mediana(montosPorClienteMXN),
    count: montosPorClienteMXN.length,
  };
}

export type Concentracion = { topPct: number; top3Pct: number; total: number };

/** Qué tan concentrado está el ingreso del rango: % que viene del cliente
 * más grande y de los 3 más grandes. Un topPct alto = mucha dependencia
 * de un solo cliente (riesgo si ese cliente se va). */
export function calcularConcentracion(montosPorClienteMXN: number[]): Concentracion {
  const total = montosPorClienteMXN.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return { topPct: 0, top3Pct: 0, total: 0 };
  const ordenados = [...montosPorClienteMXN].sort((a, b) => b - a);
  const top = ordenados[0] ?? 0;
  const top3 = ordenados.slice(0, 3).reduce((acc, v) => acc + v, 0);
  return { topPct: (top / total) * 100, top3Pct: (top3 / total) * 100, total };
}

/** "Run rate": recaudado del rango dividido entre los meses que abarca
 * (mínimo 1), para tener una cifra mensual comparable aunque el rango sea
 * de 10 días o de 8 meses. */
export function calcularIngresoMensualPromedio(totalMXN: number, desde: Date, hasta: Date): number {
  const meses =
    (hasta.getFullYear() - desde.getFullYear()) * 12 +
    (hasta.getMonth() - desde.getMonth()) +
    // fracción del mes en curso, para que "1–9 sep" no cuente como 0 meses
    (hasta.getDate() - desde.getDate() + 1) / 30;
  return totalMXN / Math.max(1, meses);
}

/** Margen: qué fracción de lo recaudado queda como utilidad después de
 * los gastos de empresa. 0 si no se recaudó nada. */
export function calcularMargen(recaudadoMXN: number, gastosEmpresaMXN: number): number {
  if (recaudadoMXN <= 0) return 0;
  return ((recaudadoMXN - gastosEmpresaMXN) / recaudadoMXN) * 100;
}

const CUBETAS_TICKET: { label: string; max: number }[] = [
  { label: "< $5k", max: 5_000 },
  { label: "$5k–15k", max: 15_000 },
  { label: "$15k–30k", max: 30_000 },
  { label: "$30k–60k", max: 60_000 },
  { label: "> $60k", max: Infinity },
];

/** Histograma del tamaño de los servicios nuevos del rango -- para ver de
 * un vistazo si son parejos o si hay de todo (lo que el promedio y la
 * mediana solo resumen en un número). */
export function bucketsTicket(montosMXN: number[]): { label: string; count: number }[] {
  const conteo = CUBETAS_TICKET.map((c) => ({ label: c.label, count: 0 }));
  for (const m of montosMXN) {
    const idx = CUBETAS_TICKET.findIndex((c) => m < c.max);
    conteo[idx === -1 ? conteo.length - 1 : idx].count++;
  }
  return conteo;
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

export type TicketPorMes = { key: string; label: string; mediana: number; count: number };

const MES_CORTO_KPI = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Ticket típico mes a mes dentro del rango (mediana, ver arriba) -- a
 * diferencia de agruparRecaudadoGastos (reportes.ts), aquí siempre es
 * por mes (nunca por día): un "ticket de hoy" no dice nada, y la
 * pregunta que de verdad importa es cómo se mueve mes a mes. */
export function agruparTicketTipicoPorMes(
  servicios: { fecha: Date; montoMXN: number }[],
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
    const key = `${s.fecha.getUTCFullYear()}-${String(s.fecha.getUTCMonth() + 1).padStart(2, "0")}`;
    const grupo = grupos.get(key);
    if (grupo) grupo.montos.push(s.montoMXN);
  }
  return Array.from(grupos.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, g]) => ({ key, label: g.label, mediana: mediana(g.montos), count: g.montos.length }));
}
