// Nombre a mostrar para una cotización que puede o no tener cliente
// registrado — mientras es prospecto usa prospectoNombre.
export function nombreClienteCotizacion(c: {
  cliente?: { nombre: string } | null;
  prospectoNombre?: string | null;
}): string {
  return c.cliente?.nombre ?? c.prospectoNombre ?? "Prospecto";
}

type MontoLike = number | string | { toString(): string };
type PagoParaMonto = { monto: MontoLike; confirmado: boolean };
type CotizacionParaMonto = { montoTotal: MontoLike; porcentajeAnticipo: number | null };

// Suma de lo que el cliente ya pagó y quedó confirmado (los pendientes de
// revisión — transferencia manual sin confirmar aún — no cuentan).
export function montoPagadoCotizacion(pagos: PagoParaMonto[]): number {
  return pagos
    .filter((p) => p.confirmado)
    .reduce((suma, p) => suma + Number(p.monto), 0);
}

// Si la cotización tiene anticipo configurado, el monto en dinero que
// representa ese % sobre el total actual (se recalcula siempre sobre el
// total vigente, no queda congelado si la cotización se edita después).
export function montoAnticipoCotizacion(cotizacion: CotizacionParaMonto): number | null {
  if (!cotizacion.porcentajeAnticipo) return null;
  return Number(cotizacion.montoTotal) * (cotizacion.porcentajeAnticipo / 100);
}

export function montoPendienteCotizacion(
  cotizacion: CotizacionParaMonto,
  pagos: PagoParaMonto[]
): number {
  const pendiente = Number(cotizacion.montoTotal) - montoPagadoCotizacion(pagos);
  return Math.max(pendiente, 0);
}

// Cuánto hay que cobrar en el siguiente pago: si no se ha pagado nada y
// hay anticipo configurado, es el anticipo; en cualquier otro caso
// (liquidación, o cotizaciones sin anticipo) es todo el saldo restante.
export function montoAPagarAhora(
  cotizacion: CotizacionParaMonto,
  pagos: PagoParaMonto[]
): number {
  const pagado = montoPagadoCotizacion(pagos);
  const pendiente = Math.max(Number(cotizacion.montoTotal) - pagado, 0);
  if (pagado === 0) {
    const anticipo = montoAnticipoCotizacion(cotizacion);
    if (anticipo) return Math.min(anticipo, pendiente);
  }
  return pendiente;
}

// true cuando ya se cubrió el total (con un pequeño margen de tolerancia
// por redondeo de centavos al calcular porcentajes).
export function cotizacionQuedaSaldada(
  cotizacion: CotizacionParaMonto,
  pagos: PagoParaMonto[]
): boolean {
  return montoPendienteCotizacion(cotizacion, pagos) <= 0.01;
}
