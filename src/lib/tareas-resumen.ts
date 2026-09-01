import type { PrioridadTarea } from "@/generated/prisma/client";
import { diaMexicoISO, hoyEnMexico } from "@/lib/fecha";
import { granularidadPeriodo, type Granularidad } from "@/lib/reportes";

// Día en México, no en UTC -- si no, una tarea completada entrada la
// noche (hora de México) se contaba en el día siguiente, y "completadas
// hoy"/la racha se veían en cero aunque sí se hubiera completado algo.
const toDateKey = diaMexicoISO;

export type ResumenTareas = {
  pendientesCount: number;
  completadasHoy: number;
  progresoPct: number;
  racha: number;
  proximaPrioridad: PrioridadTarea | null;
};

/**
 * Calcula los indicadores del panel de resumen a partir de las tareas pendientes
 * (para "próxima prioridad") y las fechas de finalización de los últimos ~30 días
 * (para racha, tendencia y completadas hoy). Todo derivado, sin tablas nuevas.
 */
export function calcularResumenTareas(
  pendientes: { prioridad: PrioridadTarea }[],
  completadasEnFechas: Date[]
): ResumenTareas {
  const hoy = hoyEnMexico();
  const hoyKey = toDateKey(hoy);

  const porDia = new Map<string, number>();
  for (const fecha of completadasEnFechas) {
    const key = toDateKey(fecha);
    porDia.set(key, (porDia.get(key) ?? 0) + 1);
  }

  const completadasHoy = porDia.get(hoyKey) ?? 0;
  const pendientesCount = pendientes.length;
  const enJuego = pendientesCount + completadasHoy;
  const progresoPct = enJuego > 0 ? Math.round((completadasHoy / enJuego) * 100) : 0;

  // Racha: días consecutivos desde hoy hacia atrás con al menos 1 completada.
  let racha = 0;
  const cursor = new Date(hoy);
  while (true) {
    const key = toDateKey(cursor);
    if ((porDia.get(key) ?? 0) > 0) {
      racha += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }

  const ORDEN: PrioridadTarea[] = ["Alta", "Media", "Baja"];
  const proximaPrioridad =
    ORDEN.find((p) => pendientes.some((t) => t.prioridad === p)) ?? null;

  return { pendientesCount, completadasHoy, progresoPct, racha, proximaPrioridad };
}

export type CompletadasPorPeriodo = { hoy: number; dias7: number; dias30: number; mes: number; ano: number };

/** Cuenta rápida de completadas en cada ventana fija (hoy/7 días/30
 * días/este mes/este año), siempre visible sin importar qué rango
 * personalizado esté eligiendo el filtro de la página -- para tener el
 * dato de un vistazo sin tener que ir cambiando el filtro uno por uno.
 * `ahora` debe ser hoyEnMexico() (medianoche UTC del día de hoy en
 * México), y `fechas` debe cubrir al menos desde el 1 de enero. */
export function calcularCompletadasPorPeriodosFijos(fechas: Date[], ahora: Date): CompletadasPorPeriodo {
  const inicioHoy = ahora.getTime();
  const inicio7 = inicioHoy - 6 * 86_400_000;
  const inicio30 = inicioHoy - 29 * 86_400_000;
  const inicioMes = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1);
  const inicioAno = Date.UTC(ahora.getUTCFullYear(), 0, 1);
  // "Hoy" llega hasta el final del día, no solo su medianoche.
  const finHoy = inicioHoy + 86_400_000;

  let hoy = 0;
  let dias7 = 0;
  let dias30 = 0;
  let mes = 0;
  let ano = 0;
  for (const fecha of fechas) {
    const t = fecha.getTime();
    if (t >= inicioHoy && t < finHoy) hoy++;
    if (t >= inicio7) dias7++;
    if (t >= inicio30) dias30++;
    if (t >= inicioMes) mes++;
    if (t >= inicioAno) ano++;
  }
  return { hoy, dias7, dias30, mes, ano };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const MES_CORTO_TAREAS = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

export type PuntoTareas = { key: string; label: string; completadas: number };

/** Igual espíritu que agruparRecaudadoGastos (reportes.ts) pero para una
 * sola serie (tareas completadas) -- día o mes según el rango, mismo
 * criterio de granularidad, para que el gráfico de Tareas se sienta
 * como el de Reportes en vez de una cosa aparte y más pobre. */
export function agruparTareasCompletadasPorPeriodo(
  fechas: Date[],
  desde: Date,
  hasta: Date
): { puntos: PuntoTareas[]; granularidad: Granularidad } {
  const granularidad = granularidadPeriodo(desde, hasta);

  function claveYLabel(fecha: Date): { key: string; label: string } {
    if (granularidad === "dia") {
      const key = `${fecha.getUTCFullYear()}-${pad2(fecha.getUTCMonth() + 1)}-${pad2(fecha.getUTCDate())}`;
      return { key, label: `${pad2(fecha.getUTCDate())} ${MES_CORTO_TAREAS[fecha.getUTCMonth()]}` };
    }
    const key = `${fecha.getUTCFullYear()}-${pad2(fecha.getUTCMonth() + 1)}`;
    return { key, label: `${MES_CORTO_TAREAS[fecha.getUTCMonth()]} ${String(fecha.getUTCFullYear()).slice(2)}` };
  }

  const puntos = new Map<string, PuntoTareas>();
  const cursor = new Date(desde);
  let guard = 0;
  while (cursor.getTime() <= hasta.getTime() && guard < 400) {
    const { key, label } = claveYLabel(cursor);
    if (!puntos.has(key)) puntos.set(key, { key, label, completadas: 0 });
    if (granularidad === "mes") {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    guard++;
  }
  const { key: keyHasta, label: labelHasta } = claveYLabel(hasta);
  if (!puntos.has(keyHasta)) puntos.set(keyHasta, { key: keyHasta, label: labelHasta, completadas: 0 });

  for (const fecha of fechas) {
    const { key } = claveYLabel(fecha);
    const punto = puntos.get(key);
    if (punto) punto.completadas += 1;
  }

  return {
    puntos: Array.from(puntos.values()).sort((a, b) => a.key.localeCompare(b.key)),
    granularidad,
  };
}
