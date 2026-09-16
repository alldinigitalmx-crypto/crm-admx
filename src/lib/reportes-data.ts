// Capa de datos compartida por /admin/reportes (la página), el PDF y los
// Excel de ingresos/gastos — todos calculan el mismo rango de fechas y los
// mismos totales de la misma forma, para que lo que se exporta cuadre
// siempre con lo que se ve en pantalla.
import { prisma } from "@/lib/prisma";
import {
  construirRangoFecha,
  rangoEfectivo,
  rangoComparacion,
  agruparRecaudadoGastos,
  granularidadPeriodo,
  topNConOtros,
  type Granularidad,
  type ModoComparacion,
  type PuntoPeriodo,
} from "@/lib/reportes";
import { METODO_LABEL } from "@/lib/metodo-pago";
import { montoEnMXN, montoNetoEnMXN } from "@/lib/pago-monto";
import { montoPendienteServicio, montoPagadoServicio } from "@/lib/servicio";
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
  // Siempre en MXN (ver montoEnMXN) -- si el pago original fue en otra
  // moneda, monedaOriginal/montoOriginal traen el dato tal cual se
  // registró, solo para mostrarlo de referencia.
  monto: number;
  comisionMXN: number;
  monedaOriginal: string | null;
  montoOriginal: number | null;
};
export type ReporteGastoDetalle = {
  fecha: Date;
  descripcion: string;
  categoria: string;
  monto: number;
};
export type PendienteGrupo = { count: number; monto: number };
export type PendienteServicioDetalle = {
  id: number;
  descripcion: string;
  cliente: string;
  status: StatusServicio;
  fechaInicio: Date;
  moneda: string;
  cobrado: number;
  pendiente: number;
  esIntermediario: boolean;
};

// Los mismos totales del reporte pero para el rango contra el que se
// compara (mes/año anterior). Solo cifras agregadas -- ninguna lista de
// detalle -- para que traer la comparación cueste casi nada.
export type ReporteComparacion = {
  modo: ModoComparacion;
  desde: Date;
  hasta: Date;
  totalRecaudado: number;
  totalGastos: number;
  utilidadNeta: number;
  totalGastosPersonales: number;
  serviciosEntregadosCount: number;
  serviciosNuevosCount: number;
  clientesNuevosCount: number;
  pagosCount: number;
  gastosCount: number;
  // "recaudado" del rango de comparación, agrupado con la misma
  // granularidad y alineado por posición con puntosPeriodo -- para la
  // línea punteada del gráfico de tendencia.
  recaudadoPorPeriodo: number[];
};
// Un servicio "confirmado" (Aprobado/EnProceso) puede deberse a que ya
// arrancó pero aún no se cobra completo. No se cuenta Cotizado (todavía
// no es un trato en firme) ni Entregado/Cancelado (si ya se concluyó y el
// monto final quedó distinto al cotizado, eso es una diferencia a
// resolver aparte, no un "pendiente por recibir" real). Separado por
// moneda porque un pendiente en USD no se puede sumar con uno en MXN.
export type PendientePorRecibirMoneda = {
  moneda: string;
  propios: PendienteGrupo;
  intermediarios: PendienteGrupo;
  total: PendienteGrupo;
};

export type ReporteData = {
  desde?: string;
  hasta?: string;
  desdeEfectivo: Date;
  hastaEfectivo: Date;
  totalRecaudado: number;
  totalGastos: number;
  utilidadNeta: number;
  // Gasto personal del dueño -- se muestra aparte a propósito, nunca
  // sumado a totalGastos ni restado de utilidadNeta (esa sigue siendo
  // solo del negocio). Cuando algún día se agreguen impuestos, este es
  // el lugar natural para sumarlos también por separado.
  totalGastosPersonales: number;
  pagosCount: number;
  gastosCount: number;
  gastosPersonalesCount: number;
  serviciosEntregadosCount: number;
  serviciosNuevosCount: number;
  clientesNuevosCount: number;
  puntosPeriodo: PuntoPeriodo[];
  granularidadPeriodo: Granularidad;
  statusItems: ReporteFila[];
  metodoItems: ReporteFila[];
  gastosItems: ReporteFila[];
  gastosPersonalesItems: ReporteFila[];
  topClientes: ReporteCliente[];
  pagosDetalle: ReportePagoDetalle[];
  gastosDetalle: ReporteGastoDetalle[];
  gastosPersonalesDetalle: ReporteGastoDetalle[];
  pendientePorRecibir: PendientePorRecibirMoneda[];
  // Detalle servicio por servicio de "Pendiente por recibir" -- misma
  // foto del momento que los totales de arriba, ordenado por lo que más
  // falta cobrar primero. Acotado a un puñado para la tarjeta de
  // Reportes (el listado completo vive en /admin/servicios).
  pendienteServiciosDetalle: PendienteServicioDetalle[];
  comparacion?: ReporteComparacion;
};

// Totales agregados de un rango cualquiera -- se usa para el bloque de
// comparación (mes/año anterior) sin duplicar la lógica de cómo se cuenta
// cada cosa. Usa montoNetoEnMXN igual que el reporte principal.
async function totalesDeRango(rango: { gte: Date; lte: Date }) {
  const [pagos, gastosSum, gastosPersonalesSum, serviciosNuevos, serviciosEntregadosCount, clientesNuevosCount] =
    await Promise.all([
      prisma.pago.findMany({
        where: { confirmado: true, fecha: rango },
        select: { fecha: true, monto: true, moneda: true, montoMXN: true, comision: true, montoIncluyeComision: true },
      }),
      prisma.gasto.aggregate({ _sum: { monto: true }, _count: true, where: { ambito: "Empresa", fecha: rango } }),
      prisma.gasto.aggregate({ _sum: { monto: true }, where: { ambito: "Personal", fecha: rango } }),
      prisma.servicio.count({ where: { fechaInicio: rango } }),
      prisma.servicio.count({ where: { status: "Entregado", fechaFin: rango } }),
      prisma.cliente.count({ where: { creadoEn: rango } }),
    ]);
  const totalRecaudado = pagos.reduce((acc, p) => acc + montoNetoEnMXN(p), 0);
  const totalGastos = Number(gastosSum._sum.monto ?? 0);
  return {
    pagos,
    totalRecaudado,
    totalGastos,
    utilidadNeta: totalRecaudado - totalGastos,
    totalGastosPersonales: Number(gastosPersonalesSum._sum.monto ?? 0),
    serviciosNuevosCount: serviciosNuevos,
    serviciosEntregadosCount,
    clientesNuevosCount,
    pagosCount: pagos.length,
    gastosCount: gastosSum._count,
  };
}

export function etiquetaComparacion(modo: ModoComparacion): string {
  return modo === "año" ? "año pasado" : "periodo anterior";
}

/** Filas de la tabla "Comparativa" que se muestra en pantalla y se
 * repite igual en el PDF y el Excel -- una sola definición del qué se
 * compara para que los tres cuadren. `null` si no hay comparación. */
export type FilaComparativa = {
  metrica: string;
  actual: number;
  previo: number;
  esDinero: boolean;
  buenoCuando: "up" | "down";
};

export function filasComparativa(datos: ReporteData): FilaComparativa[] | null {
  const c = datos.comparacion;
  if (!c) return null;
  return [
    { metrica: "Total recaudado", actual: datos.totalRecaudado, previo: c.totalRecaudado, esDinero: true, buenoCuando: "up" },
    { metrica: "Gastos (empresa)", actual: datos.totalGastos, previo: c.totalGastos, esDinero: true, buenoCuando: "down" },
    { metrica: "Utilidad neta", actual: datos.utilidadNeta, previo: c.utilidadNeta, esDinero: true, buenoCuando: "up" },
    {
      metrica: "Gastos personales",
      actual: datos.totalGastosPersonales,
      previo: c.totalGastosPersonales,
      esDinero: true,
      buenoCuando: "down",
    },
    {
      metrica: "Servicios nuevos",
      actual: datos.serviciosNuevosCount,
      previo: c.serviciosNuevosCount,
      esDinero: false,
      buenoCuando: "up",
    },
    {
      metrica: "Servicios entregados",
      actual: datos.serviciosEntregadosCount,
      previo: c.serviciosEntregadosCount,
      esDinero: false,
      buenoCuando: "up",
    },
    {
      metrica: "Clientes nuevos",
      actual: datos.clientesNuevosCount,
      previo: c.clientesNuevosCount,
      esDinero: false,
      buenoCuando: "up",
    },
  ];
}

export async function obtenerDatosReportes(
  desde?: string,
  hasta?: string,
  comparar?: ModoComparacion
): Promise<ReporteData> {
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
  const gastosPersonalesWhere: Prisma.GastoWhereInput = { ambito: "Personal" };
  if (rango) gastosPersonalesWhere.fecha = rango;
  const serviciosNuevosWhere: Prisma.ServicioWhereInput = {};
  if (rango) serviciosNuevosWhere.fechaInicio = rango;
  const serviciosEntregadosWhere: Prisma.ServicioWhereInput = { status: "Entregado" };
  if (rango) serviciosEntregadosWhere.fechaFin = rango;
  const clientesNuevosWhere: Prisma.ClienteWhereInput = {};
  if (rango) clientesNuevosWhere.creadoEn = rango;

  const [
    pagos,
    gastos,
    gastosPersonales,
    serviciosNuevos,
    serviciosEntregadosCount,
    clientesNuevosCount,
    serviciosActivos,
  ] = await Promise.all([
    prisma.pago.findMany({
      where: pagosWhere,
      select: {
        fecha: true,
        monto: true,
        moneda: true,
        montoMXN: true,
        comision: true,
        montoIncluyeComision: true,
        metodoPago: true,
        servicio: { select: { descripcion: true, cliente: { select: { id: true, nombre: true } } } },
      },
      orderBy: { fecha: "asc" },
    }),
    prisma.gasto.findMany({
      where: gastosWhere,
      select: { fecha: true, descripcion: true, monto: true, categoria: true },
    }),
    prisma.gasto.findMany({
      where: gastosPersonalesWhere,
      select: { fecha: true, descripcion: true, monto: true, categoria: true },
    }),
    prisma.servicio.findMany({
      where: serviciosNuevosWhere,
      select: { status: true },
    }),
    prisma.servicio.count({ where: serviciosEntregadosWhere }),
    prisma.cliente.count({ where: clientesNuevosWhere }),
    // "Pendiente por recibir" es una foto del momento (cuánto falta hoy
    // en trabajos ya confirmados), no algo que dependa del rango de
    // fechas del reporte -- por eso esta consulta no usa `rango`.
    prisma.servicio.findMany({
      where: { status: { in: ["Aprobado", "EnProceso"] } },
      select: {
        id: true,
        descripcion: true,
        status: true,
        fechaInicio: true,
        montoInicial: true,
        moneda: true,
        intermediarioId: true,
        ordenesCambio: { select: { status: true, monto: true } },
        pagos: { select: { monto: true, confirmado: true, moneda: true } },
        cliente: { select: { nombre: true } },
      },
    }),
  ]);

  // Un pago en USD/COP no se puede sumar en crudo junto con uno en MXN —
  // montoNetoEnMXN() usa el equivalente en pesos que se capturó al
  // registrar el pago, y le resta la comisión de la pasarela cuando
  // corresponde (ver src/lib/pago-monto.ts) para que "cuánto ingresó" no
  // cuente de más lo que PayPal/Mercado Pago se quedaron. Este es el
  // único total que de verdad importa para el negocio, por eso todo lo
  // demás de este archivo (tendencia, por método, por cliente, detalle)
  // también lo usa.
  const totalRecaudado = pagos.reduce((acc, p) => acc + montoNetoEnMXN(p), 0);
  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto), 0);
  const utilidadNeta = totalRecaudado - totalGastos;
  // Aparte a propósito -- ver el comentario en ReporteData.
  const totalGastosPersonales = gastosPersonales.reduce((acc, g) => acc + Number(g.monto), 0);

  const puntosPeriodo = agruparRecaudadoGastos(
    pagos.map((p) => ({ fecha: p.fecha, monto: montoNetoEnMXN(p) })),
    gastos.map((g) => ({ fecha: g.fecha, monto: Number(g.monto) })),
    desdeEfectivo,
    hastaEfectivo,
    gastosPersonales.map((g) => ({ fecha: g.fecha, monto: Number(g.monto) }))
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
    cur.monto += montoNetoEnMXN(p);
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

  const gastosPersonalesPorCategoria = new Map<string, { monto: number; count: number }>();
  for (const g of gastosPersonales) {
    const cur = gastosPersonalesPorCategoria.get(g.categoria) ?? { monto: 0, count: 0 };
    cur.monto += Number(g.monto);
    cur.count += 1;
    gastosPersonalesPorCategoria.set(g.categoria, cur);
  }
  const gastosPersonalesItems: ReporteFila[] = topNConOtros(
    Array.from(gastosPersonalesPorCategoria.entries()).map(([label, v]) => ({
      label,
      monto: v.monto,
      count: v.count,
    })),
    5
  );

  const porCliente = new Map<number, { nombre: string; monto: number; count: number }>();
  for (const p of pagos) {
    const c = p.servicio.cliente;
    const cur = porCliente.get(c.id) ?? { nombre: c.nombre, monto: 0, count: 0 };
    cur.monto += montoNetoEnMXN(p);
    cur.count += 1;
    porCliente.set(c.id, cur);
  }
  const topClientes: ReporteCliente[] = Array.from(porCliente.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);

  const gruposPendiente = new Map<string, PendientePorRecibirMoneda>();
  const pendienteServiciosDetalle: PendienteServicioDetalle[] = [];
  for (const s of serviciosActivos) {
    const pendiente = montoPendienteServicio(s, s.pagos);
    if (pendiente <= 0.01) continue; // ya saldado -- no cuenta como "falta"

    const moneda = s.moneda ?? "MXN";
    const grupo = gruposPendiente.get(moneda) ?? {
      moneda,
      propios: { count: 0, monto: 0 },
      intermediarios: { count: 0, monto: 0 },
      total: { count: 0, monto: 0 },
    };
    const bucket = s.intermediarioId ? grupo.intermediarios : grupo.propios;
    bucket.count += 1;
    bucket.monto += pendiente;
    grupo.total.count += 1;
    grupo.total.monto += pendiente;
    gruposPendiente.set(moneda, grupo);

    pendienteServiciosDetalle.push({
      id: s.id,
      descripcion: s.descripcion,
      cliente: s.cliente.nombre,
      status: s.status,
      fechaInicio: s.fechaInicio,
      moneda,
      cobrado: montoPagadoServicio(s, s.pagos),
      pendiente,
      esIntermediario: s.intermediarioId !== null,
    });
  }
  const pendientePorRecibir = Array.from(gruposPendiente.values()).sort((a, b) =>
    a.moneda === "MXN" ? -1 : b.moneda === "MXN" ? 1 : a.moneda.localeCompare(b.moneda)
  );
  pendienteServiciosDetalle.sort((a, b) => b.pendiente - a.pendiente);

  let comparacion: ReporteComparacion | undefined;
  if (comparar) {
    const rc = rangoComparacion(desdeEfectivo, hastaEfectivo, comparar);
    const t = await totalesDeRango({ gte: rc.desde, lte: rc.hasta });
    const puntosComp = agruparRecaudadoGastos(
      t.pagos.map((p) => ({ fecha: p.fecha, monto: montoNetoEnMXN(p) })),
      [],
      rc.desde,
      rc.hasta
    );
    comparacion = {
      modo: comparar,
      desde: rc.desde,
      hasta: rc.hasta,
      totalRecaudado: t.totalRecaudado,
      totalGastos: t.totalGastos,
      utilidadNeta: t.utilidadNeta,
      totalGastosPersonales: t.totalGastosPersonales,
      serviciosEntregadosCount: t.serviciosEntregadosCount,
      serviciosNuevosCount: t.serviciosNuevosCount,
      clientesNuevosCount: t.clientesNuevosCount,
      pagosCount: t.pagosCount,
      gastosCount: t.gastosCount,
      recaudadoPorPeriodo: puntosComp.map((p) => p.recaudado),
    };
  }

  return {
    desde,
    hasta,
    desdeEfectivo,
    hastaEfectivo,
    totalRecaudado,
    totalGastos,
    utilidadNeta,
    totalGastosPersonales,
    pagosCount: pagos.length,
    gastosCount: gastos.length,
    gastosPersonalesCount: gastosPersonales.length,
    serviciosEntregadosCount,
    serviciosNuevosCount: serviciosNuevos.length,
    clientesNuevosCount,
    puntosPeriodo,
    granularidadPeriodo: granularidadPeriodo(desdeEfectivo, hastaEfectivo),
    statusItems,
    metodoItems,
    gastosItems,
    gastosPersonalesItems,
    topClientes,
    pendientePorRecibir,
    pendienteServiciosDetalle: pendienteServiciosDetalle.slice(0, 12),
    comparacion,
    pagosDetalle: pagos.map((p) => ({
      fecha: p.fecha,
      servicio: p.servicio.descripcion,
      cliente: p.servicio.cliente.nombre,
      metodoPago: METODO_LABEL[p.metodoPago] ?? p.metodoPago,
      monto: montoNetoEnMXN(p),
      comisionMXN: p.montoIncluyeComision ? montoEnMXN(p) - montoNetoEnMXN(p) : 0,
      monedaOriginal: p.moneda && p.moneda !== "MXN" ? p.moneda : null,
      montoOriginal: p.moneda && p.moneda !== "MXN" ? Number(p.monto) : null,
    })),
    gastosDetalle: gastos.map((g) => ({
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: Number(g.monto),
    })),
    gastosPersonalesDetalle: gastosPersonales.map((g) => ({
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: Number(g.monto),
    })),
  };
}
