// Regresión lineal por mínimos cuadrados -- funciones puras, sin JSX
// (mismo patrón que kpis.ts/reportes.ts). Se usa en /admin/proyeccion
// para ver la tendencia del negocio mes a mes y proyectarla a futuro.

export type RegresionLineal = {
  // y = pendiente*x + interseccion
  pendiente: number;
  interseccion: number;
  // R² (0 a 1): qué tan bien la recta explica los puntos reales. Cerca
  // de 1 = tendencia clara y estable; cerca de 0 = muy irregular, la
  // proyección es poco confiable aunque la cuenta esté bien hecha.
  r2: number;
  n: number;
};

/** Ajuste por mínimos cuadrados: la recta y = a + b·x que minimiza la
 * suma de los errores al cuadrado contra los puntos dados. Fórmula
 * cerrada de toda la vida (Gauss/Legendre), sin librería. */
export function minimosCuadrados(puntos: { x: number; y: number }[]): RegresionLineal {
  const n = puntos.length;
  if (n === 0) return { pendiente: 0, interseccion: 0, r2: 0, n: 0 };
  if (n === 1) return { pendiente: 0, interseccion: puntos[0].y, r2: 0, n: 1 };

  let sumaX = 0;
  let sumaY = 0;
  let sumaXY = 0;
  let sumaX2 = 0;
  for (const { x, y } of puntos) {
    sumaX += x;
    sumaY += y;
    sumaXY += x * y;
    sumaX2 += x * x;
  }
  const denom = n * sumaX2 - sumaX * sumaX;
  // Todos los puntos con la misma x (no debería pasar con meses
  // consecutivos, pero cubre el caso de un solo periodo repetido).
  if (denom === 0) return { pendiente: 0, interseccion: sumaY / n, r2: 0, n };

  const pendiente = (n * sumaXY - sumaX * sumaY) / denom;
  const mediaY = sumaY / n;
  const interseccion = (sumaY - pendiente * sumaX) / n;

  let ssRes = 0; // suma de residuos al cuadrado (recta vs. real)
  let ssTot = 0; // suma total al cuadrado (media vs. real)
  for (const { x, y } of puntos) {
    const pred = interseccion + pendiente * x;
    ssRes += (y - pred) ** 2;
    ssTot += (y - mediaY) ** 2;
  }
  const r2 = ssTot === 0 ? (ssRes === 0 ? 1 : 0) : Math.max(0, 1 - ssRes / ssTot);

  return { pendiente, interseccion, r2, n };
}

/** Valor proyectado de la recta en x. */
export function proyectar(regresion: RegresionLineal, x: number): number {
  return regresion.interseccion + regresion.pendiente * x;
}

const MES_CORTO_REGRESION = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function claveMes(anio: number, mes: number) {
  return `${anio}-${String(mes + 1).padStart(2, "0")}`;
}

export type PuntoMensual = { key: string; label: string; anio: number; mes: number; recaudado: number };

/** Agrupa pagos en meses calendario (siempre por mes, a diferencia de
 * agruparRecaudadoGastos en reportes.ts, que cambia a día en rangos
 * cortos -- aquí la tendencia SIEMPRE es mes a mes, sin importar qué tan
 * corta sea la ventana elegida). Incluye los meses sin pagos (en $0),
 * para que la regresión no salte huecos. */
export function agruparRecaudadoMensual(pagos: { fecha: Date; monto: number }[], desde: Date, hasta: Date): PuntoMensual[] {
  const meses = new Map<string, PuntoMensual>();
  const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  const limite = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), 1));
  let guard = 0;
  while (cursor.getTime() <= limite.getTime() && guard < 600) {
    const anio = cursor.getUTCFullYear();
    const mes = cursor.getUTCMonth();
    meses.set(claveMes(anio, mes), {
      key: claveMes(anio, mes),
      label: `${MES_CORTO_REGRESION[mes]} ${String(anio).slice(2)}`,
      anio,
      mes,
      recaudado: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    guard++;
  }
  for (const p of pagos) {
    const key = claveMes(p.fecha.getUTCFullYear(), p.fecha.getUTCMonth());
    const punto = meses.get(key);
    if (punto) punto.recaudado += p.monto;
  }
  return Array.from(meses.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/** El mes calendario que sigue a (anio, mes), N meses adelante --
 * para generar las etiquetas de los meses proyectados. */
export function mesSiguiente(anio: number, mes: number, n: number): { anio: number; mes: number; label: string } {
  const total = anio * 12 + mes + n;
  const anioFinal = Math.floor(total / 12);
  const mesFinal = ((total % 12) + 12) % 12;
  return { anio: anioFinal, mes: mesFinal, label: `${MES_CORTO_REGRESION[mesFinal]} ${String(anioFinal).slice(2)}` };
}
