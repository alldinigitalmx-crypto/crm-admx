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
