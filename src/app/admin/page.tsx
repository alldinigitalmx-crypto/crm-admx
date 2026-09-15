import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  Briefcase,
  CreditCard,
  FileText,
  Landmark,
  LifeBuoy,
  KeyRound,
  ListTodo,
  ShoppingBag,
  Wallet,
  User,
  ArrowUp,
  ArrowDown,
  Minus,
  PiggyBank,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import { montoPendienteServicio } from "@/lib/servicio";
import { calcularMargen } from "@/lib/kpis";
import { agruparRecaudadoMensual } from "@/lib/regresion";
import { calcularDelta, type Delta } from "@/lib/reportes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SERVICIO_STATUS_COLOR } from "@/lib/status-colors";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin, permisosModulo } from "@/lib/alcance";
import { obtenerTasasAMXN, resumirMontoMulti, type ResumenMontoMulti } from "@/lib/tipo-cambio";
import { montoNetoEnMXN } from "@/lib/pago-monto";
import { hoyEnMexico } from "@/lib/fecha";
import { formatCurrency } from "@/lib/format";
import { MiniSparkline } from "@/components/panel/mini-sparkline";
import type { Usuario } from "@/generated/prisma/client";

// Para los totales "de un vistazo" (KPIs, embudo, ventas por origen) los
// centavos no aportan nada y sí le quitan espacio a la tarjeta en móvil —
// las cantidades exactas de pagos/órdenes individuales siguen usando
// `currency` completo.
const currencyCorta = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const fecha = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const MES_LARGO = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });

// Línea de variación bajo una cifra ("↑ 18.4% vs. agosto") -- mismo criterio
// que la comparación de Reportes: verde cuando el cambio va en la dirección
// buena de esa métrica, rojo cuando no.
function DeltaLinea({ delta, contra, buenoCuando }: { delta: Delta; contra: string; buenoCuando: "up" | "down" }) {
  const bueno = delta.dir === "flat" || delta.dir === buenoCuando;
  const color = delta.dir === "flat" ? "text-muted-foreground" : bueno ? "text-success" : "text-destructive";
  const Icono = delta.dir === "up" ? ArrowUp : delta.dir === "down" ? ArrowDown : Minus;
  const texto =
    delta.pct === null ? (delta.dir === "flat" ? "igual" : "nuevo") : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(1)}%`;
  return (
    <p className={`flex items-center gap-1 text-xs ${color}`}>
      <Icono className="size-3 shrink-0" />
      <span className="font-medium">{texto}</span>
      <span className="text-muted-foreground">vs. {contra}</span>
    </p>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
  delta,
  deltaContra,
  deltaBuenoCuando = "up",
  trailing,
  accentClass = "bg-primary/10 text-primary",
  className,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  delta?: Delta;
  deltaContra?: string;
  deltaBuenoCuando?: "up" | "down";
  trailing?: React.ReactNode;
  accentClass?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 py-2 sm:gap-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 ${accentClass}`}>
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{title}</p>
          <p className="truncate text-lg font-semibold sm:text-xl">{value}</p>
          {delta && deltaContra ? (
            <DeltaLinea delta={delta} contra={deltaContra} buenoCuando={deltaBuenoCuando} />
          ) : (
            sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
        {/* El sparkline es decorativo y necesita ~120px de ancho propio --
            en el grid de 2 columnas (móvil/tablet) no hay ese espacio sin
            truncar el título/cifra de al lado, así que solo aparece desde
            lg, que es también donde esta tarjeta pasa a ocupar 2 columnas
            (ver lg:col-span-2 en el call site). */}
        {trailing && <div className="hidden shrink-0 lg:block">{trailing}</div>}
      </CardContent>
    </Card>
  );
}

// Total del embudo de venta ya convertido a pesos (ver resumirMontoMulti)
// -- si algo no se pudo convertir (COP, o si falló el tipo de cambio de
// hoy), se lista aparte en su moneda real en vez de fingir que se sumó.
function MontoFunnel({ resumen }: { resumen: ResumenMontoMulti }) {
  return (
    <>
      <span className="truncate">{currencyCorta.format(resumen.montoMXN)}</span>
      {resumen.sinConvertir.map((s) => (
        <span key={s.moneda} className="truncate">
          {" "}
          + {formatCurrency(s.monto, s.moneda)}
        </span>
      ))}
    </>
  );
}

// ---------- "Requiere tu atención": lista unificada ----------
// Antes eran hasta 6 tarjetas repetidas (una por módulo, cada una con su
// propio "no hay nada pendiente"). Se combinan en una sola lista ordenada
// por urgencia, sin pedir ningún dato nuevo -- los 6 arrays ya se traían.

type TipoPendiente = "cotizacion" | "pago" | "queja" | "ticket" | "tarea" | "orden";

type Pendiente = {
  id: string;
  tipo: TipoPendiente;
  label: string;
  sub: string;
  href: string;
  fecha: Date | null;
  monto: number | null;
  moneda: string | null;
  vencida: boolean;
};

const TIPO_META: Record<TipoPendiente, { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }> = {
  cotizacion: { label: "Cotizaciones", icon: FileText, colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  pago: { label: "Pagos", icon: Landmark, colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  queja: { label: "Quejas", icon: LifeBuoy, colorClass: "bg-red-500/15 text-red-700 dark:text-red-400" },
  ticket: { label: "Accesos", icon: KeyRound, colorClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  tarea: { label: "Tareas", icon: ListTodo, colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  orden: { label: "Órdenes de cambio", icon: Briefcase, colorClass: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
};

type DatosPendientes = {
  cotizaciones: Awaited<ReturnType<typeof cargarCotizacionesPendientes>>;
  pagos: Awaited<ReturnType<typeof cargarPagosPorConfirmar>>;
  quejas: Awaited<ReturnType<typeof cargarQuejasNuevas>>;
  tickets: Awaited<ReturnType<typeof cargarTicketsPendientes>>;
  tareas: Awaited<ReturnType<typeof cargarTareasPendientes>>;
  ordenes: Awaited<ReturnType<typeof cargarOrdenesCambioPendientes>>;
};

function cargarCotizacionesPendientes(where: Record<string, unknown>) {
  return prisma.cotizacion.findMany({
    where: { status: "Enviada", ...where },
    orderBy: { fechaVencimiento: "asc" },
    take: 10,
    include: { cliente: true, servicio: true },
  });
}
function cargarPagosPorConfirmar(where: Record<string, unknown>) {
  return prisma.pago.findMany({
    where: { confirmado: false, ...where },
    orderBy: { fecha: "asc" },
    take: 10,
    include: { servicio: { include: { cliente: true } } },
  });
}
function cargarQuejasNuevas(where: Record<string, unknown>) {
  return prisma.queja.findMany({
    where: { status: "Nueva", ...where },
    orderBy: { creadoEn: "asc" },
    take: 10,
    include: { cliente: true },
  });
}
function cargarTicketsPendientes() {
  return prisma.ticketAcceso.findMany({
    where: { status: "Pendiente" },
    orderBy: { fechaSolicitud: "asc" },
    take: 10,
    include: { usuarioSolicitante: true },
  });
}
function cargarTareasPendientes(where: Record<string, unknown>) {
  return prisma.tarea.findMany({
    where: { completada: false, ...where },
    orderBy: [{ fechaLimite: "asc" }, { creadoEn: "asc" }],
    take: 10,
    include: { servicio: true, cotizacion: { include: { cliente: true } } },
  });
}
function cargarOrdenesCambioPendientes(where: Record<string, unknown>) {
  return prisma.ordenCambio.findMany({
    where: { status: "Pendiente", ...where },
    orderBy: { creadoEn: "asc" },
    take: 10,
    include: { servicio: { include: { cliente: true } } },
  });
}

const hoyUTC = () => new Date();

function normalizarPendientes(datos: DatosPendientes): Pendiente[] {
  const ahora = hoyUTC();
  const lista: Pendiente[] = [];

  for (const c of datos.cotizaciones) {
    lista.push({
      id: `cot-${c.id}`,
      tipo: "cotizacion",
      label: `${nombreClienteCotizacion(c)} — ${c.servicio?.descripcion ?? c.descripcion ?? "Negociación"}`,
      sub: "Por firmar/pagar",
      href: `/admin/cotizaciones/${c.id}`,
      fecha: c.fechaVencimiento,
      monto: Number(c.montoTotal),
      moneda: c.moneda,
      vencida: Boolean(c.fechaVencimiento && c.fechaVencimiento < ahora),
    });
  }
  for (const p of datos.pagos) {
    lista.push({
      id: `pag-${p.id}`,
      tipo: "pago",
      label: `${p.servicio.cliente.nombre} — ${p.servicio.descripcion}`,
      sub: "Por confirmar",
      href: p.cotizacionId ? `/admin/cotizaciones/${p.cotizacionId}` : `/admin/servicios/${p.servicio.id}`,
      fecha: p.fecha,
      monto: Number(p.monto),
      moneda: p.moneda,
      vencida: false,
    });
  }
  for (const q of datos.quejas) {
    lista.push({
      id: `que-${q.id}`,
      tipo: "queja",
      label: `${q.cliente.nombre} — ${q.categoria}`,
      sub: "Nueva",
      href: "/admin/quejas",
      fecha: q.creadoEn,
      monto: null,
      moneda: null,
      vencida: false,
    });
  }
  for (const t of datos.tickets) {
    lista.push({
      id: `tic-${t.id}`,
      tipo: "ticket",
      label: `${t.usuarioSolicitante.nombre} — ${t.moduloSolicitado}`,
      sub: "Ticket de acceso",
      href: "/admin/usuarios",
      fecha: t.fechaSolicitud,
      monto: null,
      moneda: null,
      vencida: false,
    });
  }
  for (const t of datos.tareas) {
    const proyecto = t.servicio?.descripcion ?? (t.cotizacion ? nombreClienteCotizacion(t.cotizacion) : null);
    lista.push({
      id: `tar-${t.id}`,
      tipo: "tarea",
      label: t.titulo + (proyecto ? ` — ${proyecto}` : ""),
      sub: t.prioridad === "Alta" ? "Prioridad alta" : "Tarea pendiente",
      href: t.servicioId
        ? `/admin/servicios/${t.servicioId}`
        : t.cotizacionId
          ? `/admin/cotizaciones/${t.cotizacionId}`
          : "/admin/tareas",
      fecha: t.fechaLimite,
      monto: null,
      moneda: null,
      vencida: Boolean(t.fechaLimite && t.fechaLimite < ahora),
    });
  }
  for (const o of datos.ordenes) {
    lista.push({
      id: `ord-${o.id}`,
      tipo: "orden",
      label: `${o.servicio.cliente.nombre} — ${o.descripcion}`,
      sub: "Por aprobar",
      href: `/admin/servicios/${o.servicio.id}`,
      fecha: o.creadoEn,
      monto: Number(o.monto),
      moneda: null,
      vencida: false,
    });
  }

  return lista.sort((a, b) => {
    if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
    const fa = a.fecha?.getTime() ?? Infinity;
    const fb = b.fecha?.getTime() ?? Infinity;
    return fa - fb;
  });
}

function ListaPendientes({ pendientes, filtro }: { pendientes: Pendiente[]; filtro?: string }) {
  const vencidasCount = pendientes.filter((p) => p.vencida).length;
  const mostrar = filtro === "vencidos" ? pendientes.filter((p) => p.vencida) : pendientes;
  const base = "/admin";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">
          Requiere tu atención {pendientes.length > 0 && <span className="text-muted-foreground">· {pendientes.length}</span>}
        </CardTitle>
        {pendientes.length > 0 && (
          <div className="flex gap-1.5">
            <Button asChild size="sm" variant={filtro !== "vencidos" ? "default" : "outline"}>
              <Link href={base}>Todos</Link>
            </Button>
            <Button asChild size="sm" variant={filtro === "vencidos" ? "default" : "outline"} disabled={vencidasCount === 0}>
              <Link href={`${base}?filtro=vencidos`}>Vencidos{vencidasCount > 0 ? ` (${vencidasCount})` : ""}</Link>
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {pendientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes pendientes en ningún módulo.</p>
        ) : mostrar.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay nada vencido — buen trabajo.</p>
        ) : (
          <div className="flex flex-col">
            {mostrar.map((p) => {
              const meta = TIPO_META[p.tipo];
              const Icon = meta.icon;
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.colorClass}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {meta.label} · {p.sub}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.monto !== null && (
                      <p className="text-sm font-medium tabular-nums">{formatCurrency(p.monto, p.moneda)}</p>
                    )}
                    <p className={`text-xs ${p.vencida ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {p.fecha ? fecha.format(p.fecha) : "—"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const usuario = await currentUsuario();
  if (!usuario) redirect("/login");

  const { filtro } = await searchParams;

  // El panel del dueño (Admin) es un resumen financiero de todo el
  // negocio; el de un usuario interno normal es solo lo que le toca a
  // él — nunca ingresos, embudo de venta ni ventas por origen de la
  // empresa completa.
  if (!esAdmin(usuario)) return <PanelUsuario usuario={usuario} filtro={filtro} />;
  return <PanelAdmin filtro={filtro} />;
}

async function PanelAdmin({ filtro }: { filtro?: string }) {
  // hoyEnMexico() en vez de new Date(): el servidor corre en UTC, y
  // new Date().setDate(1) se adelanta al mes siguiente desde la tarde del
  // último día de cada mes (hora de México) -- justo cuando "Ingresos del
  // mes" más importa que no se vacíe de golpe.
  const hoy = hoyEnMexico();
  const inicioDeMes = new Date(hoy);
  inicioDeMes.setUTCDate(1);
  // 6 meses atrás (incluyendo el actual) -- para el sparkline y para poder
  // comparar "lo que va del mes" contra el mismo tramo del mes pasado, sin
  // pedir los pagos dos veces.
  const inicioSparkline = new Date(Date.UTC(inicioDeMes.getUTCFullYear(), inicioDeMes.getUTCMonth() - 5, 1));
  const mesPasadoInicio = new Date(Date.UTC(inicioDeMes.getUTCFullYear(), inicioDeMes.getUTCMonth() - 1, 1));
  // Mismo día del mes que hoy, para comparar manzanas con manzanas (1-14 de
  // septiembre vs. 1-14 de agosto, no contra todo agosto).
  const mesPasadoHasta = new Date(Date.UTC(inicioDeMes.getUTCFullYear(), inicioDeMes.getUTCMonth() - 1, hoy.getUTCDate() + 1));

  const [
    totalClientes,
    serviciosActivosDetalle,
    totalServicios,
    pagosUltimosMeses,
    serviciosPorStatus,
    cotizacionesPendientes,
    pagosPorConfirmar,
    quejasNuevas,
    ticketsPendientes,
    ordenesCambioPendientes,
    tareasPendientes,
    enNegociacion,
    ganadasPorFormalizar,
    convertidasAServicio,
    perdidas,
    ventasPorOrigen,
    gastosPorAmbito,
    tasas,
  ] = await Promise.all([
    prisma.cliente.count(),
    // Detalle (no solo count) -- hace falta para calcular "Por cobrar" con
    // montoPendienteServicio() por cada uno, ver más abajo.
    prisma.servicio.findMany({
      where: { status: { in: ["Aprobado", "EnProceso"] } },
      select: {
        clienteId: true,
        montoInicial: true,
        moneda: true,
        ordenesCambio: { select: { status: true, monto: true } },
        pagos: { select: { monto: true, confirmado: true, moneda: true } },
      },
    }),
    prisma.servicio.count(),
    // Un solo fetch cubre "ingresos del mes", "vs. mes pasado" y el
    // sparkline de 6 meses -- no es un aggregate() porque hay que restar
    // la comisión de la pasarela y convertir a MXN registro por registro
    // (ver montoNetoEnMXN); son pocos pagos al mes, no pesa nada.
    prisma.pago.findMany({
      where: { fecha: { gte: inicioSparkline }, confirmado: true },
      select: { fecha: true, monto: true, moneda: true, montoMXN: true, comision: true, montoIncluyeComision: true },
    }),
    prisma.servicio.groupBy({ by: ["status"], _count: true }),
    cargarCotizacionesPendientes({}),
    cargarPagosPorConfirmar({}),
    cargarQuejasNuevas({}),
    cargarTicketsPendientes(),
    cargarOrdenesCambioPendientes({}),
    cargarTareasPendientes({}),
    // findMany + moneda en vez de aggregate(_sum) -- una cotización en
    // USD/EUR no se puede sumar en crudo junto con una en MXN (ver
    // resumirMontoMulti más abajo, mismo criterio que ya se usa en
    // Reportes y Pagos para no mezclar monedas).
    prisma.cotizacion.findMany({
      select: { montoTotal: true, moneda: true },
      where: { status: "Enviada", servicioId: null },
    }),
    prisma.cotizacion.findMany({
      select: { montoTotal: true, moneda: true },
      where: { status: "Firmada", servicioId: null },
    }),
    prisma.cotizacion.findMany({
      select: { montoTotal: true, moneda: true },
      where: { servicioId: { not: null } },
    }),
    prisma.cotizacion.findMany({
      select: { montoTotal: true, moneda: true },
      where: { status: "Perdida" },
    }),
    prisma.venta.groupBy({
      by: ["origen"],
      _sum: { total: true },
      _count: true,
      where: { fecha: { gte: inicioDeMes } },
    }),
    // Personal y Empresa por separado -- para que el dueño vea cuánto se
    // gastó en él mismo vs. en el negocio, nunca mezclado en un solo
    // total (a diferencia de Reportes/Utilidad neta, que es solo Empresa).
    prisma.gasto.groupBy({
      by: ["ambito"],
      _sum: { monto: true },
      _count: true,
      where: { fecha: { gte: inicioDeMes } },
    }),
    obtenerTasasAMXN(),
  ]);

  const serviciosActivos = serviciosActivosDetalle.length;
  const aprobadosCount = serviciosPorStatus.find((s) => s.status === "Aprobado")?._count ?? 0;
  const enProcesoCount = serviciosPorStatus.find((s) => s.status === "EnProceso")?._count ?? 0;

  // "Por cobrar": lo que falta de cobrar en cada servicio activo (mismo
  // criterio de montoPendienteServicio que ya usa Servicios/Reportes),
  // sumado en MXN y contando clientes distintos con saldo.
  const pendientesPorServicio = serviciosActivosDetalle.map((s) => ({
    clienteId: s.clienteId,
    pendiente: montoPendienteServicio(s, s.pagos),
    moneda: s.moneda,
  }));
  const conSaldo = pendientesPorServicio.filter((s) => s.pendiente > 0.01);
  const porCobrarResumen = resumirMontoMulti(
    conSaldo.map((s) => ({ monto: s.pendiente, moneda: s.moneda })),
    tasas
  );
  const clientesConSaldo = new Set(conSaldo.map((s) => s.clienteId)).size;

  // Ingresos: este mes, mes pasado (mismo tramo de días) y los 6 meses
  // para el sparkline -- todo del mismo fetch de arriba.
  const puntosMensuales = agruparRecaudadoMensual(
    pagosUltimosMeses.map((p) => ({ fecha: p.fecha, monto: montoNetoEnMXN(p) })),
    inicioSparkline,
    inicioDeMes
  );
  const ingresosMesMXN = pagosUltimosMeses
    .filter((p) => p.fecha >= inicioDeMes)
    .reduce((acc, p) => acc + montoNetoEnMXN(p), 0);
  const ingresosMesPasadoMXN = pagosUltimosMeses
    .filter((p) => p.fecha >= mesPasadoInicio && p.fecha < mesPasadoHasta)
    .reduce((acc, p) => acc + montoNetoEnMXN(p), 0);
  const deltaIngresos = calcularDelta(ingresosMesMXN, ingresosMesPasadoMXN);
  const mesPasadoLabel = MES_LARGO.format(mesPasadoInicio).split(" de ")[0];

  const gastosEmpresa = gastosPorAmbito.find((g) => g.ambito === "Empresa");
  const gastosPersonal = gastosPorAmbito.find((g) => g.ambito === "Personal");
  const gastosEmpresaMXN = Number(gastosEmpresa?._sum.monto ?? 0);
  const utilidadEstimada = ingresosMesMXN - gastosEmpresaMXN;
  const margen = calcularMargen(ingresosMesMXN, gastosEmpresaMXN);

  const resumenEnNegociacion = resumirMontoMulti(
    enNegociacion.map((c) => ({ monto: Number(c.montoTotal), moneda: c.moneda })),
    tasas
  );
  const resumenGanadasPorFormalizar = resumirMontoMulti(
    ganadasPorFormalizar.map((c) => ({ monto: Number(c.montoTotal), moneda: c.moneda })),
    tasas
  );
  const resumenConvertidasAServicio = resumirMontoMulti(
    convertidasAServicio.map((c) => ({ monto: Number(c.montoTotal), moneda: c.moneda })),
    tasas
  );
  const resumenPerdidas = resumirMontoMulti(
    perdidas.map((c) => ({ monto: Number(c.montoTotal), moneda: c.moneda })),
    tasas
  );
  const embudoItems: {
    label: string;
    resumen: ResumenMontoMulti;
    href?: string;
    colorClass: string;
  }[] = [
    { label: "En negociación", resumen: resumenEnNegociacion, href: "/admin/cotizaciones?status=Enviada", colorClass: "bg-blue-500" },
    {
      label: "Ganadas por formalizar",
      resumen: resumenGanadasPorFormalizar,
      href: "/admin/cotizaciones?status=Firmada",
      colorClass: "bg-violet-500",
    },
    { label: "Convertidas a servicio", resumen: resumenConvertidasAServicio, colorClass: "bg-emerald-500" },
    { label: "Perdidas", resumen: resumenPerdidas, href: "/admin/cotizaciones?status=Perdida", colorClass: "bg-red-500" },
  ];
  const embudoMax = Math.max(1, ...embudoItems.map((e) => e.resumen.count));

  const ventasTiendaOnline = ventasPorOrigen.find((v) => v.origen === "TiendaOnline");
  const ventasManual = ventasPorOrigen.find((v) => v.origen === "Manual");

  const pendientes = normalizarPendientes({
    cotizaciones: cotizacionesPendientes,
    pagos: pagosPorConfirmar,
    quejas: quejasNuevas,
    tickets: ticketsPendientes,
    tareas: tareasPendientes,
    ordenes: ordenesCambioPendientes,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="text-sm capitalize text-muted-foreground">{MES_LARGO.format(hoy)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard
          className="lg:col-span-2"
          title="Cobrado este mes"
          value={currencyCorta.format(ingresosMesMXN)}
          icon={CreditCard}
          accentClass="bg-success/10 text-success"
          delta={deltaIngresos}
          deltaContra={mesPasadoLabel}
          trailing={<MiniSparkline valores={puntosMensuales.map((p) => p.recaudado)} />}
        />
        <KpiCard
          title="Por cobrar"
          value={currencyCorta.format(porCobrarResumen.montoMXN)}
          icon={Landmark}
          accentClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          sub={`${clientesConSaldo} cliente${clientesConSaldo === 1 ? "" : "s"} con saldo`}
        />
        <KpiCard
          title="Servicios en curso"
          value={String(serviciosActivos)}
          icon={Briefcase}
          sub={`${aprobadosCount} aprobados · ${enProcesoCount} en proceso`}
        />
        <KpiCard
          title="Utilidad estimada"
          value={currencyCorta.format(utilidadEstimada)}
          icon={PiggyBank}
          accentClass={utilidadEstimada >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
          sub={`${margen.toFixed(0)}% de margen este mes`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <ListaPendientes pendientes={pendientes} filtro={filtro} />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Embudo de venta</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {embudoItems.map((item) => {
                const contenido = (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                        <span className={`size-2 shrink-0 rounded-full ${item.colorClass}`} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted-foreground">
                        {item.resumen.count} · <MontoFunnel resumen={item.resumen} />
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${item.colorClass} transition-all duration-500`}
                        style={{ width: `${Math.max(2, (item.resumen.count / embudoMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
                return item.href ? (
                  <Link key={item.label} href={item.href} className="-m-1 rounded-lg p-1 transition-colors hover:bg-muted/40">
                    {contenido}
                  </Link>
                ) : (
                  <div key={item.label}>{contenido}</div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Servicios por status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {serviciosPorStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay servicios registrados.</p>
              ) : (
                serviciosPorStatus.map((s) => (
                  <Link key={s.status} href={`/admin/servicios?status=${s.status}`}>
                    <Badge className={SERVICIO_STATUS_COLOR[s.status] ?? ""}>
                      {s.status}: {s._count}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Ventas del mes</h2>
          <p className="mb-3 text-sm text-muted-foreground">Por origen</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/ventas?origen=TiendaOnline">
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShoppingBag className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">Tienda Online</p>
                    <p className="truncate text-lg font-semibold">
                      {currencyCorta.format(Number(ventasTiendaOnline?._sum.total ?? 0))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ventasTiendaOnline?._count ?? 0} venta{(ventasTiendaOnline?._count ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/ventas?origen=Manual">
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShoppingBag className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">Manual (otros medios)</p>
                    <p className="truncate text-lg font-semibold">
                      {currencyCorta.format(Number(ventasManual?._sum.total ?? 0))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ventasManual?._count ?? 0} venta{(ventasManual?._count ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Gastos del mes</h2>
          <p className="mb-3 text-sm text-muted-foreground">Personal vs. empresa</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/gastos?ambito=Empresa">
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wallet className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">Empresa</p>
                    <p className="truncate text-lg font-semibold">{currencyCorta.format(gastosEmpresaMXN)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {gastosEmpresa?._count ?? 0} gasto{(gastosEmpresa?._count ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/gastos?ambito=Personal">
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">Personal</p>
                    <p className="truncate text-lg font-semibold">
                      {currencyCorta.format(Number(gastosPersonal?._sum.monto ?? 0))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {gastosPersonal?._count ?? 0} gasto{(gastosPersonal?._count ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Total de servicios registrados: {totalServicios} · Clientes: {totalClientes}</p>
    </div>
  );
}

// Panel de un usuario interno normal (no Admin): nada de ingresos,
// embudo de venta ni ventas por origen de la empresa — solo lo que a
// él le toca, y solo de los módulos que de verdad tiene otorgados.
// Cada consulta usa el mismo criterio de "propio" que ya usa la lista
// real de ese módulo (responsableId del servicio, asignadoAId, o quién
// creó el registro), así que si más adelante se le da alcance "Todo" en
// algún módulo, este panel automáticamente le muestra todo ahí también.
async function PanelUsuario({ usuario, filtro }: { usuario: Usuario; filtro?: string }) {
  const [permisosClientes, permisosServicios, permisosCotizaciones, permisosPagos, permisosQuejas, permisosTareas] =
    await Promise.all([
      permisosModulo(usuario, "Clientes"),
      permisosModulo(usuario, "Servicios"),
      permisosModulo(usuario, "Cotizaciones"),
      permisosModulo(usuario, "Pagos"),
      permisosModulo(usuario, "Quejas"),
      permisosModulo(usuario, "Tareas"),
    ]);

  const cotizacionPropiaWhere = permisosCotizaciones.verTodo
    ? {}
    : { OR: [{ creadoPorId: usuario.id }, { servicio: { responsableId: usuario.id } }] };
  const quejaPropiaWhere = permisosQuejas.verTodo
    ? {}
    : { OR: [{ asignadoAId: usuario.id }, { servicio: { responsableId: usuario.id } }] };
  const pagoPropioWhere = permisosPagos.verTodo ? {} : { servicio: { responsableId: usuario.id } };
  const tareaPropiaWhere = permisosTareas.verTodo ? {} : { asignadoAId: usuario.id };
  const ordenPropiaWhere = permisosServicios.verTodo ? {} : { servicio: { responsableId: usuario.id } };

  const [
    misClientesCount,
    misServiciosActivosCount,
    misCotizacionesPendientesCount,
    misTareasPendientesCount,
    serviciosPorStatus,
    cotizacionesPendientes,
    pagosPorConfirmar,
    quejasNuevas,
    tareasPendientes,
    ordenesCambioPendientes,
  ] = await Promise.all([
    permisosClientes.puedeVer
      ? prisma.cliente.count({
          where: permisosClientes.verTodo ? {} : { servicios: { some: { responsableId: usuario.id } } },
        })
      : Promise.resolve(0),
    permisosServicios.puedeVer
      ? prisma.servicio.count({
          where: {
            status: { in: ["Aprobado", "EnProceso"] },
            ...(permisosServicios.verTodo ? {} : { responsableId: usuario.id }),
          },
        })
      : Promise.resolve(0),
    permisosCotizaciones.puedeVer
      ? prisma.cotizacion.count({ where: { status: "Enviada", ...cotizacionPropiaWhere } })
      : Promise.resolve(0),
    permisosTareas.puedeVer
      ? prisma.tarea.count({
          where: { completada: false, ...(permisosTareas.verTodo ? {} : { asignadoAId: usuario.id }) },
        })
      : Promise.resolve(0),
    permisosServicios.puedeVer
      ? prisma.servicio.groupBy({
          by: ["status"],
          _count: true,
          where: permisosServicios.verTodo ? {} : { responsableId: usuario.id },
        })
      : Promise.resolve([]),
    permisosCotizaciones.puedeVer ? cargarCotizacionesPendientes(cotizacionPropiaWhere) : Promise.resolve([]),
    permisosPagos.puedeVer ? cargarPagosPorConfirmar(pagoPropioWhere) : Promise.resolve([]),
    permisosQuejas.puedeVer ? cargarQuejasNuevas(quejaPropiaWhere) : Promise.resolve([]),
    permisosTareas.puedeVer ? cargarTareasPendientes(tareaPropiaWhere) : Promise.resolve([]),
    permisosServicios.puedeVer ? cargarOrdenesCambioPendientes(ordenPropiaWhere) : Promise.resolve([]),
  ]);

  const kpis: { title: string; value: string; icon: React.ComponentType<{ className?: string }> }[] = [];
  if (permisosClientes.puedeVer) kpis.push({ title: "Mis clientes", value: String(misClientesCount), icon: Users });
  if (permisosServicios.puedeVer)
    kpis.push({ title: "Mis servicios activos", value: String(misServiciosActivosCount), icon: Briefcase });
  if (permisosCotizaciones.puedeVer)
    kpis.push({
      title: "Mis cotizaciones pendientes",
      value: String(misCotizacionesPendientesCount),
      icon: FileText,
    });
  if (permisosTareas.puedeVer)
    kpis.push({ title: "Mis tareas pendientes", value: String(misTareasPendientesCount), icon: ListTodo });

  const tieneAlgunModulo =
    permisosCotizaciones.puedeVer ||
    permisosPagos.puedeVer ||
    permisosQuejas.puedeVer ||
    permisosTareas.puedeVer ||
    permisosServicios.puedeVer;

  const pendientes = normalizarPendientes({
    cotizaciones: permisosCotizaciones.puedeVer ? cotizacionesPendientes : [],
    pagos: permisosPagos.puedeVer ? pagosPorConfirmar : [],
    quejas: permisosQuejas.puedeVer ? quejasNuevas : [],
    tickets: [],
    tareas: permisosTareas.puedeVer ? tareasPendientes : [],
    ordenes: permisosServicios.puedeVer ? ordenesCambioPendientes : [],
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="text-sm text-muted-foreground">Resumen de lo que te corresponde</p>
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.title} title={k.title} value={k.value} icon={k.icon} />
          ))}
        </div>
      )}

      {permisosServicios.puedeVer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Mis servicios por status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {serviciosPorStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes servicios asignados.</p>
            ) : (
              serviciosPorStatus.map((s) => (
                <Link key={s.status} href={`/admin/servicios?status=${s.status}`}>
                  <Badge className={SERVICIO_STATUS_COLOR[s.status] ?? ""}>
                    {s.status}: {s._count}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tieneAlgunModulo && <ListaPendientes pendientes={pendientes} filtro={filtro} />}

      {kpis.length === 0 && !tieneAlgunModulo && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Todavía no tienes acceso a ningún módulo. Pídele a un administrador que te lo asigne desde Usuarios y
            Accesos.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
