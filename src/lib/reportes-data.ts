// Capa de datos compartida por /admin/reportes (la página), el PDF y los
// Excel de ingresos/gastos — todos calculan el mismo rango de fechas y los
// mismos totales de la misma forma, para que lo que se exporta cuadre
// siempre con lo que se ve en pantalla.
import { prisma } from "@/lib/prisma";
import {
  construirRangoFecha,
  rangoEfectivo,
  agruparRecaudadoGastos,
  granularidadPeriodo,
  topNConOtros,
  type Granularidad,
  type PuntoPeriodo,
} from "@/lib/reportes";
import { METODO_LABEL } from "@/lib/metodo-pago";
import type { Prisma, StatusServicio } from "@/generated/prisma/client";

export const STATUS_ORDEN: StatusServicio[] = [
  "Cotizado",
  "Aprobado",
  "EnProceso",
  "Entregado",
  "Cancelado",
];

export type ReporteFila = { label: string; monto: number; count: number };
export type ReporteCliente = { id: number; nombre: string; monto: number; count: number };
export type ReportePagoDetalle = {
  fecha: Date;
  servicio: string;
  cliente: string;
  metodoPago: string;
  monto: number;
};
export type ReporteGastoDetalle = {
  fecha: Date;
  descripcion: string;
  categoria: string;
  monto: number;
};

export type ReporteData = {
  desde?: string;
  hasta?: string;
  desdeEfectivo: Date;
  hastaEfectivo: Date;
  totalRecaudado: number;
  totalGastos: number;
  utilidadNeta: number;
  pagosCount: number;
  gastosCount: number;
  serviciosEntregadosCount: number;
  serviciosNuevosCount: number;
  clientesNuevosCount: number;
  puntosPeriodo: PuntoPeriodo[];
  granularidadPeriodo: Granularidad;
  statusItems: ReporteFila[];
  metodoItems: ReporteFila[];
  gastosItems: ReporteFila[];
  topClientes: ReporteCliente[];
  pagosDetalle: ReportePagoDetalle[];
  gastosDetalle: ReporteGastoDetalle[];
};

export async function obtenerDatosReportes(desde?: string, hasta?: string): Promise<ReporteData> {
  const rango = construirRangoFecha(desde, hasta);

  const [minPago, minGasto, minServicio] = await Promise.all([
    prisma.pago.aggregate({ _min: { fecha: true } }),
    prisma.gasto.aggregate({ _min: { fecha: true } }),
    prisma.servicio.aggregate({ _min: { fechaInicio: true } }),
  ]);
  const candidatos = [minPago._min.fecha, minGasto._min.fecha, minServicio._min.fechaInicio].filter(
    (d): d is Date => d !== null
  );
  const primerRegistro = candidatos.length ? new Date(Math.min(...candidatos.map((d) => d.getTime()))) : null;
  const { desde: desdeEfectivo, hasta: hastaEfectivo } = rangoEfectivo(desde, hasta, primerRegistro);

  const pagosWhere: Prisma.PagoWhereInput = { confirmado: true };
  if (rango) pagosWhere.fecha = rango;
  const gastosWhere: Prisma.GastoWhereInput = { ambito: "Empresa" };
  if (rango) gastosWhere.fecha = rango;
  const serviciosNuevosWhere: Prisma.ServicioWhereInput = {};
  if (rango) serviciosNuevosWhere.fechaInicio = rango;
  const serviciosEntregadosWhere: Prisma.ServicioWhereInput = { status: "Entregado" };
  if (rango) serviciosEntregadosWhere.fechaFin = rango;
  const clientesNuevosWhere: Prisma.ClienteWhereInput = {};
  if (rango) clientesNuevosWhere.creadoEn = rango;

  const [pagos, gastos, serviciosNuevos, serviciosEntregadosCount, clientesNuevosCount] = await Promise.all([
    prisma.pago.findMany({
      where: pagosWhere,
      select: {
        fecha: true,
        monto: true,
        metodoPago: true,
        servicio: { select: { descripcion: true, cliente: { select: { id: true, nombre: true } } } },
      },
      orderBy: { fecha: "asc" },
    }),
    prisma.gasto.findMany({
      where: gastosWhere,
      select: { fecha: true, descripcion: true, monto: true, categoria: true },
    }),
    prisma.servicio.findMany({
      where: serviciosNuevosWhere,
      select: { status: true },
    }),
    prisma.servicio.count({ where: serviciosEntregadosWhere }),
    prisma.cliente.count({ where: clientesNuevosWhere }),
  ]);

  const totalRecaudado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto), 0);
  const utilidadNeta = totalRecaudado - totalGastos;

  const puntosPeriodo = agruparRecaudadoGastos(
    pagos.map((p) => ({ fecha: p.fecha, monto: Number(p.monto) })),
    gastos.map((g) => ({ fecha: g.fecha, monto: Number(g.monto) })),
    desdeEfectivo,
    hastaEfectivo
  );

  const statusCounts = Object.fromEntries(STATUS_ORDEN.map((s) => [s, 0])) as Record<StatusServicio, number>;
  for (const s of serviciosNuevos) statusCounts[s.status]++;
  const statusItems: ReporteFila[] = STATUS_ORDEN.map((s) => ({
    label: s,
    monto: statusCounts[s],
    count: statusCounts[s],
  }));

  const metodoTotales = new Map<string, { monto: number; count: number }>();
  for (const p of pagos) {
    const cur = metodoTotales.get(p.metodoPago) ?? { monto: 0, count: 0 };
    cur.monto += Number(p.monto);
    cur.count += 1;
    metodoTotales.set(p.metodoPago, cur);
  }
  const metodoEntradas = Array.from(metodoTotales.entries()).sort((a, b) => b[1].monto - a[1].monto);
  const metodoTop = metodoEntradas.slice(0, 8);
  const metodoResto = metodoEntradas.slice(8);
  const metodoItems: ReporteFila[] = metodoTop.map(([metodo, v]) => ({
    label: METODO_LABEL[metodo] ?? metodo,
    monto: v.monto,
    count: v.count,
  }));
  if (metodoResto.length > 0) {
    metodoItems.push({
      label: "Otros",
      monto: metodoResto.reduce((acc, [, v]) => acc + v.monto, 0),
      count: metodoResto.reduce((acc, [, v]) => acc + v.count, 0),
    });
  }

  const gastosPorCategoria = new Map<string, { monto: number; count: number }>();
  for (const g of gastos) {
    const cur = gastosPorCategoria.get(g.categoria) ?? { monto: 0, count: 0 };
    cur.monto += Number(g.monto);
    cur.count += 1;
    gastosPorCategoria.set(g.categoria, cur);
  }
  const gastosItems: ReporteFila[] = topNConOtros(
    Array.from(gastosPorCategoria.entries()).map(([label, v]) => ({ label, monto: v.monto, count: v.count })),
    5
  );

  const porCliente = new Map<number, { nombre: string; monto: number; count: number }>();
  for (const p of pagos) {
    const c = p.servicio.cliente;
    const cur = porCliente.get(c.id) ?? { nombre: c.nombre, monto: 0, count: 0 };
    cur.monto += Number(p.monto);
    cur.count += 1;
    porCliente.set(c.id, cur);
  }
  const topClientes: ReporteCliente[] = Array.from(porCliente.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);

  return {
    desde,
    hasta,
    desdeEfectivo,
    hastaEfectivo,
    totalRecaudado,
    totalGastos,
    utilidadNeta,
    pagosCount: pagos.length,
    gastosCount: gastos.length,
    serviciosEntregadosCount,
    serviciosNuevosCount: serviciosNuevos.length,
    clientesNuevosCount,
    puntosPeriodo,
    granularidadPeriodo: granularidadPeriodo(desdeEfectivo, hastaEfectivo),
    statusItems,
    metodoItems,
    gastosItems,
    topClientes,
    pagosDetalle: pagos.map((p) => ({
      fecha: p.fecha,
      servicio: p.servicio.descripcion,
      cliente: p.servicio.cliente.nombre,
      metodoPago: METODO_LABEL[p.metodoPago] ?? p.metodoPago,
      monto: Number(p.monto),
    })),
    gastosDetalle: gastos.map((g) => ({
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: Number(g.monto),
    })),
  };
}
