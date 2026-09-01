import type { PrioridadTarea } from "@/generated/prisma/client";
import { diaMexicoISO, hoyEnMexico } from "@/lib/fecha";

// Día en México, no en UTC -- si no, una tarea completada entrada la
// noche (hora de México) se contaba en el día siguiente, y "completadas
// hoy"/la racha se veían en cero aunque sí se hubiera completado algo.
const toDateKey = diaMexicoISO;

export type ResumenTareas = {
  pendientesCount: number;
  completadasHoy: number;
  progresoPct: number;
  racha: number;
  tendencia7: { fecha: string; completadas: number }[];
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

  // Tendencia de los últimos 7 días (incluye hoy).
  const tendencia7: { fecha: string; completadas: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy);
    d.setUTCDate(d.getUTCDate() - i);
    const key = toDateKey(d);
    tendencia7.push({ fecha: key, completadas: porDia.get(key) ?? 0 });
  }

  const ORDEN: PrioridadTarea[] = ["Alta", "Media", "Baja"];
  const proximaPrioridad =
    ORDEN.find((p) => pendientes.some((t) => t.prioridad === p)) ?? null;

  return { pendientesCount, completadasHoy, progresoPct, racha, tendencia7, proximaPrioridad };
}
