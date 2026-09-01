// El servidor (Vercel) corre en UTC, pero el negocio vive en hora de
// Ciudad de México -- sin este helper, cualquier "hoy"/"inicio de mes"
// calculado con new Date() + getUTCFullYear/getUTCMonth/getUTCDate se
// adelanta hasta 6 horas cada tarde/noche. La mayoría de los días eso
// solo corre el punto de corte unas horas, pero la noche del último día
// de cada mes "hoy" ya cae en el mes siguiente -- el filtro "Este mes"
// de Reportes (y cualquier otro "inicio de mes"/"hoy") apunta entonces a
// un mes que apenas va a empezar, sin un solo registro, y el reporte se
// ve vacío aunque los datos sí estén ahí.
//
// México no cambia de horario desde 2022 (queda fijo en UTC-6 en la
// franja central, salvo la franja fronteriza norte) -- usar el timezone
// de IANA en vez de restar 6 horas a mano es más a prueba de futuro si
// eso cambiara otra vez.
const ZONA = "America/Mexico_City";

const FORMATO_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" del día en que cae `fecha` (un instante real, ej. un
 * timestamp de "completado el...") tal como se vive en Ciudad de México
 * -- a diferencia de fecha.toISOString().slice(0,10) (día en UTC), esto
 * no se adelanta un día para algo que pasó entrada la noche en México. */
export function diaMexicoISO(fecha: Date): string {
  return FORMATO_ISO.format(fecha);
}

/** "YYYY-MM-DD" del día que hoy es en Ciudad de México ahora mismo,
 * sin importar en qué zona horaria esté corriendo el servidor. */
export function hoyMexicoISO(): string {
  return diaMexicoISO(new Date());
}

/** El día de hoy en México, como medianoche UTC de esa fecha -- mismo
 * formato que ya usa el resto del código para "fechas de calendario"
 * (ver construirRangoFecha en reportes.ts), listo para usarse como
 * límite gte/lte de Prisma o para derivar inicio de mes/año. */
export function hoyEnMexico(): Date {
  return new Date(`${hoyMexicoISO()}T00:00:00.000Z`);
}
