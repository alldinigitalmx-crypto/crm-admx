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

type ServicioConIntermediario = ServicioConOrdenes & {
  porcentajeIntermediario?: DecimalLike | null;
};

// Cuánto le corresponde de verdad al negocio de este servicio -- cuando
// hay intermediario, su % nunca llega al dueño (lo cobra/se lo queda el
// intermediario directamente), así que NO es parte de lo que el negocio
// tiene pendiente por cobrar. Sin intermediario, es igual al total.
export function montoPropioServicio(servicio: ServicioConIntermediario): number {
  const total = montoTotalServicio(servicio);
  return total - comisionIntermediario(total, servicio.porcentajeIntermediario);
}

// Cuánto le falta cobrar al negocio por este servicio en concreto -- contra
// su propia parte (montoPropioServicio), no contra el total del contrato:
// si hay intermediario, ya se le restó su % (ver arriba), porque ese
// dinero nunca iba a llegarle al dueño aunque el cliente pague completo.
// Solo cuenta pagos confirmados en la MISMA moneda que el total del
// servicio (tratando null como MXN de los dos lados), igual que ya se hace
// para cotizaciones (ver montoPagadoCotizacion en lib/cotizacion.ts): un
// pago en otra moneda no debe restarle nada a este total, o el pendiente
// sale mal.
//
// Un servicio Cancelado nunca tiene saldo pendiente: se canceló, no se va a
// cobrar el resto, así que ese "faltante" no debe seguir apareciendo como
// deuda -- el monto capturado ahí queda solo de referencia.
export function montoPendienteServicio(
  servicio: ServicioConIntermediario & { moneda?: string | null; status?: string },
  pagos: PagoParaMonto[]
): number {
  if (servicio.status === "Cancelado") return 0;
  return Math.max(montoPropioServicio(servicio) - montoPagadoServicio(servicio, pagos), 0);
}

// Cuánto se ha cobrado ya de este servicio -- mismo criterio de moneda
// que montoPendienteServicio (un pago en otra moneda no cuenta aquí). Sin
// el Math.max de arriba a propósito: si el cliente pagó de más, aquí sí
// se ve el número real pagado, no uno recortado al total.
export function montoPagadoServicio(
  servicio: { moneda?: string | null },
  pagos: PagoParaMonto[]
): number {
  const monedaServicio = servicio.moneda ?? "MXN";
  return pagos
    .filter((p) => p.confirmado && (p.moneda ?? "MXN") === monedaServicio)
    .reduce((acc, p) => acc + Number(p.monto), 0);
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
