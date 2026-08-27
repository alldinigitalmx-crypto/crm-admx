type DecimalLike = number | string | { toString(): string };

type ServicioConOrdenes = {
  montoInicial: DecimalLike;
  ordenesCambio: { status: string; monto: DecimalLike }[];
};

export function montoTotalServicio(servicio: ServicioConOrdenes) {
  const ordenesAprobadas = servicio.ordenesCambio
    .filter((o) => o.status === "Aprobada")
    .reduce((acc, o) => acc + Number(o.monto), 0);

  return Number(servicio.montoInicial) + ordenesAprobadas;
}

type PagoParaMonto = { monto: DecimalLike; confirmado: boolean; moneda?: string | null };

// Cuánto le falta cobrar al negocio por este servicio en concreto -- solo
// cuenta pagos confirmados en la MISMA moneda que el total del servicio
// (tratando null como MXN de los dos lados), igual que ya se hace para
// cotizaciones (ver montoPagadoCotizacion en lib/cotizacion.ts): un pago
// en otra moneda no debe restarle nada a este total, o el pendiente sale
// mal.
export function montoPendienteServicio(
  servicio: ServicioConOrdenes & { moneda?: string | null },
  pagos: PagoParaMonto[]
): number {
  const monedaServicio = servicio.moneda ?? "MXN";
  const pagado = pagos
    .filter((p) => p.confirmado && (p.moneda ?? "MXN") === monedaServicio)
    .reduce((acc, p) => acc + Number(p.monto), 0);
  return Math.max(montoTotalServicio(servicio) - pagado, 0);
}

export function comisionIntermediario(
  montoTotal: number,
  porcentaje: DecimalLike | null | undefined
) {
  if (!porcentaje) return 0;
  return montoTotal * (Number(porcentaje) / 100);
}

export function calcularAvance(tareas: { completada: boolean }[]) {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.completada).length;
  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
  return { total, completadas, porcentaje };
}
