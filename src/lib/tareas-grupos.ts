export type GrupoTarea = "vencidas" | "hoy" | "semana" | "despues";

export const GRUPOS_TAREA: { key: GrupoTarea; titulo: string }[] = [
  { key: "vencidas", titulo: "Vencidas" },
  { key: "hoy", titulo: "Hoy" },
  { key: "semana", titulo: "Esta semana" },
  { key: "despues", titulo: "Después" },
];

// Una tarea sin fecha límite cae en "hoy" (la bandeja más visible) en vez
// de "después" -- si no, una tarea sin fecha que hoy se veía en
// Pendientes quedaría escondida hasta el final de la lista.
export function grupoDeTarea(fechaLimite: Date | null, hoy: Date): GrupoTarea {
  if (!fechaLimite) return "hoy";

  const t = fechaLimite.getTime();
  const inicioHoy = hoy.getTime();
  if (t < inicioHoy) return "vencidas";

  const finHoy = inicioHoy + 86_400_000;
  if (t < finHoy) return "hoy";

  const fin7Dias = inicioHoy + 8 * 86_400_000;
  if (t < fin7Dias) return "semana";

  return "despues";
}
