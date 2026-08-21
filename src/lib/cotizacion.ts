// Nombre a mostrar para una cotización que puede o no tener cliente
// registrado — mientras es prospecto usa prospectoNombre.
export function nombreClienteCotizacion(c: {
  cliente?: { nombre: string } | null;
  prospectoNombre?: string | null;
}): string {
  return c.cliente?.nombre ?? c.prospectoNombre ?? "Prospecto";
}
