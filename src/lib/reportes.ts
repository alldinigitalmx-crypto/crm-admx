// Funciones puras para el dashboard de Reportes (/admin/reportes).
// Sin JSX, testeable — mismo patrón que src/lib/servicio.ts y
// src/lib/tareas-resumen.ts.

export type RangoFiltro = { gte?: Date; lte?: Date } | undefined;

/** Construye el filtro de fecha para Prisma a partir de los inputs "desde"/"hasta"
 * del formulario (strings "YYYY-MM-DD"). "hasta" se extiende al final del día
 * para que incluya los registros de esa fecha (a diferencia de un `lte` a
 * medianoche, que los excluiría). */
export function construirRangoFecha(desde?: string, hasta?: string): RangoFiltro {
  if (!desde && !hasta) return undefined;
  const rango: { gte?: Date; lte?: Date } = {};
  if (desde) rango.gte = new Date(`${desde}T00:00:00`);
  if (hasta) rango.lte = new Date(`${hasta}T23:59:59.999`);
  return rango;
}

/** Rango efectivo (con límites concretos) usado para agrupar por periodo y
 * para las etiquetas de la UI — si el usuario no filtró, se toma desde el
 * primer registro disponible hasta hoy. */
export function rangoEfectivo(
  desde: string | undefined,
  hasta: string | undefined,
  primerRegistro: Date | null
): { desde: Date; hasta: Date } {
  const hastaDate = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
  const desdeDate = desde
    ? new Date(`${desde}T00:00:00`)
    : (primerRegistro ?? new Date(hastaDate.getTime() - 29 * 86400000));
  return { desde: desdeDate, hasta: hastaDate };
}

export type PuntoPeriodo = { key: string; label: string; recaudado: number; gastos: number };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const MES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export type Granularidad = "dia" | "mes";

/** Un rango de un mes o menos se ve día por día; cualquier rango más largo
 * (este año, un trimestre, "todo") se ve mes por mes, para poder comparar
 * de un vistazo cómo se comportó cada mes anterior. */
export function granularidadPeriodo(desde: Date, hasta: Date): Granularidad {
  const diasTotales = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86400000));
  return diasTotales <= 45 ? "dia" : "mes";
}

/** Agrupa pagos y gastos en periodos (día o mes, ver granularidadPeriodo)
 * para el gráfico de tendencia. Ambas series comparten los mismos
 * periodos aunque una esté vacía en alguno. */
export function agruparRecaudadoGastos(
  pagos: { fecha: Date; monto: number }[],
  gastos: { fecha: Date; monto: number }[],
  desde: Date,
  hasta: Date
): PuntoPeriodo[] {
  const granularidad = granularidadPeriodo(desde, hasta);

  function claveYLabel(fecha: Date): { key: string; label: string } {
    if (granularidad === "dia") {
      const key = `${fecha.getUTCFullYear()}-${pad2(fecha.getUTCMonth() + 1)}-${pad2(fecha.getUTCDate())}`;
      return { key, label: `${pad2(fecha.getUTCDate())} ${MES_CORTO[fecha.getUTCMonth()]}` };
    }
    const key = `${fecha.getUTCFullYear()}-${pad2(fecha.getUTCMonth() + 1)}`;
    return { key, label: `${MES_CORTO[fecha.getUTCMonth()]} ${String(fecha.getUTCFullYear()).slice(2)}` };
  }

  // Genera la secuencia completa de periodos entre desde y hasta, para que
  // los meses sin movimientos también aparezcan en el eje (en vez de
  // saltarse huecos, que distorsiona la lectura de la tendencia).
  const periodos = new Map<string, PuntoPeriodo>();
  const cursor = new Date(desde);
  let guard = 0;
  while (cursor.getTime() <= hasta.getTime() && guard < 400) {
    const { key, label } = claveYLabel(cursor);
    if (!periodos.has(key)) periodos.set(key, { key, label, recaudado: 0, gastos: 0 });
    if (granularidad === "mes") {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    guard++;
  }
  // Asegura que el periodo de "hasta" quede incluido aunque el paso lo salte.
  const { key: keyHasta, label: labelHasta } = claveYLabel(hasta);
  if (!periodos.has(keyHasta)) periodos.set(keyHasta, { key: keyHasta, label: labelHasta, recaudado: 0, gastos: 0 });

  for (const p of pagos) {
    const { key } = claveYLabel(p.fecha);
    const punto = periodos.get(key);
    if (punto) punto.recaudado += p.monto;
  }
  for (const g of gastos) {
    const { key } = claveYLabel(g.fecha);
    const punto = periodos.get(key);
    if (punto) punto.gastos += g.monto;
  }

  return Array.from(periodos.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export type ItemDesglose = { label: string; monto: number; count: number };

/** Colapsa una lista larga de categorías a las N más grandes + "Otros", para
 * no generar más colores de los que un desglose categórico puede sostener. */
export function topNConOtros(items: ItemDesglose[], n: number): ItemDesglose[] {
  const ordenado = [...items].sort((a, b) => b.monto - a.monto);
  if (ordenado.length <= n) return ordenado;
  const top = ordenado.slice(0, n);
  const resto = ordenado.slice(n);
  const otros = resto.reduce(
    (acc, item) => ({
      label: "Otros",
      monto: acc.monto + item.monto,
      count: acc.count + item.count,
    }),
    { label: "Otros", monto: 0, count: 0 }
  );
  return [...top, otros];
}
