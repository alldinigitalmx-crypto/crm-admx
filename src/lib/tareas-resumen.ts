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
