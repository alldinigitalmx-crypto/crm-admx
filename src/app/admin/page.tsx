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
  ChevronRight,
  Handshake,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import { montoPendienteServicio } from "@/lib/servicio";
import { calcularMargen } from "@/lib/kpis";
import { agruparRecaudadoMensual } from "@/lib/regresion";
import { calcularDelta, type Delta } from "@/lib/reportes";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SERVICIO_STATUS_COLOR, SERVICIO_STATUS_BAR } from "@/lib/status-colors";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin, permisosModulo } from "@/lib/alcance";
import { obtenerTasasAMXN, resumirMontoMulti, type ResumenMontoMulti } from "@/lib/tipo-cambio";
import { montoNetoEnMXN } from "@/lib/pago-monto";
import { hoyEnMexico } from "@/lib/fecha";
import { formatCurrency } from "@/lib/format";
import { MiniSparklineFull } from "@/components/panel/mini-sparkline";
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

// Para "vs. 1-14 de agosto ($155.6 mil)" en la franja de KPIs -- una cifra
// de referencia, no necesita los pesos exactos.
const currencyCompacta = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fecha = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const MES_LARGO = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });

// text-transform:capitalize (que se usaba antes) pone en mayúscula la
// primera letra de CADA palabra -- por eso salía "Septiembre De 2026" en
// vez de "Septiembre de 2026". Esto solo toca la primera letra del texto.
function capitalizarPrimera(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Mismo formato que isoDate() en /admin/reportes -- para armar los links
// de "Trimestre"/"Año" del Panel hacia allá con el rango correcto.
function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

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

// Misma idea que DeltaLinea pero como pastilla (fondo de color en vez de
// solo texto) -- para la franja de KPIs grande del Panel, donde la
// comparación va aparte en texto normal y el chip solo lleva el %.
function DeltaBadge({ delta, buenoCuando }: { delta: Delta; buenoCuando: "up" | "down" }) {
  const bueno = delta.dir === "flat" || delta.dir === buenoCuando;
  const cls = delta.dir === "flat" ? "bg-muted text-muted-foreground" : bueno ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive";
  const Icono = delta.dir === "up" ? ArrowUp : delta.dir === "down" ? ArrowDown : Minus;
  const texto =
    delta.pct === null ? (delta.dir === "flat" ? "igual" : "nuevo") : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(1)}%`;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold ${cls}`}>
      <Icono className="size-3" />
      {texto}
    </span>
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

// Orden fijo (no el que devuelva groupBy) para que la barra proporcional y
// la lista de abajo siempre listen los status en el mismo orden del flujo
// de un servicio, con o sin datos en alguno.
const STATUS_SERVICIO_ORDEN = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"] as const;
const STATUS_SERVICIO_LABEL: Record<string, string> = {
  Cotizado: "Cotizado",
  Aprobado: "Aprobado",
  EnProceso: "En proceso",
  Entregado: "Entregado",
  Cancelado: "Cancelado",
};

const TIPO_META: Record<
  TipoPendiente,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string; barClass: string }
> = {
  cotizacion: { label: "Cotizaciones", icon: FileText, colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400", barClass: "border-l-blue-500" },
  pago: { label: "Pagos", icon: Landmark, colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", barClass: "border-l-emerald-500" },
  queja: { label: "Quejas", icon: LifeBuoy, colorClass: "bg-red-500/15 text-red-700 dark:text-red-400", barClass: "border-l-red-500" },
  ticket: { label: "Accesos", icon: KeyRound, colorClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400", barClass: "border-l-violet-500" },
  tarea: { label: "Tareas", icon: ListTodo, colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400", barClass: "border-l-amber-500" },
  orden: { label: "Órdenes de cambio", icon: Briefcase, colorClass: "bg-sky-500/15 text-sky-700 dark:text-sky-400", barClass: "border-l-sky-500" },
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

function FiltroPendientesTab({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-7 cursor-not-allowed items-center rounded-md px-2.5 text-xs text-muted-foreground/40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function ListaPendientes({ pendientes, filtro }: { pendientes: Pendiente[]; filtro?: string }) {
  const vencidasCount = pendientes.filter((p) => p.vencida).length;
  const mostrar = filtro === "vencidos" ? pendientes.filter((p) => p.vencida) : filtro === "dinero" ? pendientes.filter((p) => p.monto !== null) : pendientes;
  const base = "/admin";

  return (
    <Card className="gap-0">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Requiere tu atención</CardTitle>
          {pendientes.length > 0 && (
            <span className="inline-flex h-5 items-center rounded-md bg-muted px-1.5 font-mono text-[11px] font-semibold">
              {pendientes.length}
            </span>
          )}
          {vencidasCount > 0 && (
            <span className="inline-flex h-5 items-center rounded-md bg-destructive/15 px-1.5 text-[11px] font-semibold text-destructive">
              {vencidasCount} vencido{vencidasCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {pendientes.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1">
            <FiltroPendientesTab href={base} active={!filtro}>
              Todos
            </FiltroPendientesTab>
            <FiltroPendientesTab href={`${base}?filtro=vencidos`} active={filtro === "vencidos"} disabled={vencidasCount === 0}>
              Vencidos
            </FiltroPendientesTab>
            <FiltroPendientesTab href={`${base}?filtro=dinero`} active={filtro === "dinero"}>
              Dinero
            </FiltroPendientesTab>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0 py-0">
        {pendientes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No tienes pendientes en ningún módulo.</p>
        ) : mostrar.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {filtro === "dinero" ? "Nada con monto pendiente por el momento." : "No hay nada vencido — buen trabajo."}
          </p>
        ) : (
          <div className="flex flex-col">
            {mostrar.map((p) => {
              const meta = TIPO_META[p.tipo];
              const Icon = meta.icon;
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  className={`flex items-center gap-3 border-b border-l-[3px] py-2.5 pr-3 pl-3 transition-colors last:border-b-0 hover:bg-muted/50 ${
                    p.vencida ? "border-l-destructive" : meta.barClass
                  }`}
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
                      <p className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(p.monto, p.moneda)}</p>
                    )}
                    <p className={`text-xs ${p.vencida ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {p.fecha ? (p.vencida ? `Venció ${fecha.format(p.fecha)}` : fecha.format(p.fecha)) : "—"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
      {mostrar.length > 0 && (
        <CardFooter className="text-xs text-muted-foreground">Ordenado por urgencia · vencidos primero</CardFooter>
      )}
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
    gastosEmpresaUltimosMeses,
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
        porcentajeIntermediario: true,
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
    // Mismo tramo de 6 meses que pagosUltimosMeses -- para la mini gráfica
    // de barras de "Gasto de empresa" en la franja de KPIs.
    prisma.gasto.findMany({
      where: { ambito: "Empresa", fecha: { gte: inicioSparkline } },
      select: { fecha: true, monto: true },
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

  // Derivados solo para la franja de KPIs / "Entradas y salidas" -- nada
  // de esto pide datos nuevos, son los mismos arriba en otra forma.
  const diasTranscurridos = hoy.getUTCDate();
  const mesPasadoRangoTexto = `1–${diasTranscurridos} de ${mesPasadoLabel}`;

  // "Trimestre"/"Año" del selector de arriba: el Panel en sí siempre
  // calcula todo para "este mes" (cambiar eso implicaría rehacer cada
  // tarjeta para un rango arbitrario, igual que ya hace /admin/reportes),
  // así que en vez de fingir un filtro que no filtra nada, mandan ahí con
  // el rango correspondiente ya armado.
  const inicioTrimestre = new Date(Date.UTC(hoy.getUTCFullYear(), Math.floor(hoy.getUTCMonth() / 3) * 3, 1));
  const inicioAno = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));
  const hoyIso = isoDate(hoy);
  const hrefTrimestre = `/admin/reportes?desde=${isoDate(inicioTrimestre)}&hasta=${hoyIso}`;
  const hrefAno = `/admin/reportes?desde=${isoDate(inicioAno)}&hasta=${hoyIso}`;

  const gastosEmpresaMensual = agruparRecaudadoMensual(
    gastosEmpresaUltimosMeses.map((g) => ({ fecha: g.fecha, monto: Number(g.monto) })),
    inicioSparkline,
    inicioDeMes
  );
  const gastosEmpresaMax = Math.max(1, ...gastosEmpresaMensual.map((p) => p.recaudado));

  const embudoTotalCount = embudoItems.reduce((acc, i) => acc + i.resumen.count, 0);
  const embudoTotalMXN = embudoItems.reduce((acc, i) => acc + i.resumen.montoMXN, 0);
  // Tasa de cierre histórica (convertidas vs. perdidas) -- a diferencia de
  // Reportes/KPIs no se acota a un periodo aquí, así que el texto no dice
  // "últimos N días", solo lo que de verdad se calculó.
  const cerradas = resumenConvertidasAServicio.count + resumenPerdidas.count;
  const tasaCierre = cerradas > 0 ? Math.round((resumenConvertidasAServicio.count / cerradas) * 100) : null;

  const ventasTiendaOnlineMXN = Number(ventasTiendaOnline?._sum.total ?? 0);
  const ventasManualMXN = Number(ventasManual?._sum.total ?? 0);
  const ventasTotalMXN = ventasTiendaOnlineMXN + ventasManualMXN;
  const gastosPersonalMXN = Number(gastosPersonal?._sum.monto ?? 0);
  const gastoTotalMXN = gastosEmpresaMXN + gastosPersonalMXN;
  const ticketProm = (monto: number, count: number) => (count > 0 ? monto / count : 0);

  const pendientes = normalizarPendientes({
    cotizaciones: cotizacionesPendientes,
    pagos: pagosPorConfirmar,
    quejas: quejasNuevas,
    tickets: ticketsPendientes,
    tareas: tareasPendientes,
    ordenes: ordenesCambioPendientes,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[26px]">Panel</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {capitalizarPrimera(MES_LARGO.format(hoy))} · {diasTranscurridos} día{diasTranscurridos === 1 ? "" : "s"} transcurridos
          </p>
        </div>
        {/* El Panel en sí siempre calcula "este mes" -- cambiar eso de
            verdad implicaría rehacer cada tarjeta para un rango
            arbitrario, igual que ya hace /admin/reportes. En vez de un
            filtro que aparente funcionar y no haga nada, Trimestre/Año
            llevan ahí con el rango correspondiente ya armado. */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-sm">
          <span className="rounded-md bg-card px-3 py-1.5 font-medium shadow-sm" title="El Panel siempre muestra este mes">
            Este mes
          </span>
          <Link
            href={hrefTrimestre}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-sm"
            title="Ver el trimestre en Reportes"
          >
            Trimestre
          </Link>
          <Link
            href={hrefAno}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-sm"
            title="Ver el año en Reportes"
          >
            Año
          </Link>
        </div>
      </div>

      <Card className="gap-0 py-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col border-b p-4 last:border-b-0 sm:p-5 lg:border-r lg:border-b-0 lg:last:border-r-0">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <CreditCard className="size-3.5 text-success" />
              Cobrado este mes
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-[28px] leading-none font-semibold tracking-tight tabular-nums sm:text-[32px]">
                {currencyCorta.format(ingresosMesMXN)}
              </span>
              <span className="text-xs text-muted-foreground">MXN</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <DeltaBadge delta={deltaIngresos} buenoCuando="up" />
              <span className="text-xs text-muted-foreground">
                vs. {mesPasadoRangoTexto} ({currencyCompacta.format(ingresosMesPasadoMXN)})
              </span>
            </div>
            <div className="mt-auto pt-4">
              <MiniSparklineFull
                valores={puntosMensuales.map((p) => p.recaudado)}
                etiquetas={puntosMensuales.map((p) => p.label.toUpperCase())}
              />
            </div>
          </div>

          <div className="flex flex-col border-b p-4 last:border-b-0 sm:p-5 lg:border-r lg:border-b-0 lg:last:border-r-0">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Landmark className="size-3.5 text-warning" />
              Por cobrar
            </div>
            <div className="mt-2.5 font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums">
              {currencyCorta.format(porCobrarResumen.montoMXN)}
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">
              {clientesConSaldo} cliente{clientesConSaldo === 1 ? "" : "s"} con saldo · {serviciosActivos} servicio
              {serviciosActivos === 1 ? "" : "s"} activo{serviciosActivos === 1 ? "" : "s"}
            </p>
            <p className="mt-auto pt-4 text-xs text-muted-foreground">
              {aprobadosCount} aprobado{aprobadosCount === 1 ? "" : "s"} · {enProcesoCount} en proceso
            </p>
          </div>

          <div className="flex flex-col border-b p-4 last:border-b-0 sm:p-5 lg:border-r lg:border-b-0 lg:last:border-r-0">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Wallet className="size-3.5 text-primary" />
              Gasto de empresa
            </div>
            <div className="mt-2.5 font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums">
              {currencyCorta.format(gastosEmpresaMXN)}
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">
              {gastosEmpresa?._count ?? 0} gasto{(gastosEmpresa?._count ?? 0) === 1 ? "" : "s"} registrado
              {(gastosEmpresa?._count ?? 0) === 1 ? "" : "s"}
            </p>
            <div className="mt-auto flex h-12 items-end gap-1.5 pt-4">
              {gastosEmpresaMensual.map((p, i) => (
                <div
                  key={p.key}
                  className={`flex-1 rounded-t-sm ${i === gastosEmpresaMensual.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                  style={{ height: `${Math.max(6, (p.recaudado / gastosEmpresaMax) * 100)}%` }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <PiggyBank className="size-3.5 text-success" />
              Utilidad estimada
            </div>
            <div
              className={`mt-2.5 font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums ${
                utilidadEstimada >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {currencyCorta.format(utilidadEstimada)}
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">Cobrado menos gasto de empresa</p>
            <div className="mt-auto pt-4">
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Margen del mes</span>
                <span className="font-mono text-sm font-semibold text-foreground">{margen.toFixed(0)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${utilidadEstimada >= 0 ? "bg-success" : "bg-destructive"}`}
                  style={{ width: `${Math.min(100, Math.max(0, Math.abs(margen)))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Montos convertidos a MXN con el tipo de cambio de hoy
            {tasas.USD != null && tasas.EUR != null && (
              <>
                {" "}
                · USD {tasas.USD.toFixed(2)} · EUR {tasas.EUR.toFixed(2)}
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            Gasto personal del mes <span className="font-mono text-foreground">{currencyCorta.format(gastosPersonalMXN)}</span>
            <span className="text-muted-foreground/70">(fuera del margen)</span>
          </span>
        </CardFooter>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <ListaPendientes pendientes={pendientes} filtro={filtro} />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="gap-0">
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-medium">Embudo de venta</CardTitle>
              <p className="text-xs text-muted-foreground">
                {embudoTotalCount} cotización{embudoTotalCount === 1 ? "" : "es"} · {currencyCorta.format(embudoTotalMXN)} en juego
              </p>
            </CardHeader>
            <CardContent className="flex flex-col divide-y py-0">
              {embudoItems.map((item) => {
                const contenido = (
                  <div className="flex flex-col gap-1.5 py-3">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                        <span className={`size-2 shrink-0 rounded-full ${item.colorClass}`} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold">
                        <MontoFunnel resumen={item.resumen} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-[5px] w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${item.colorClass} transition-all duration-500`}
                          style={{ width: `${Math.max(2, (item.resumen.count / embudoMax) * 100)}%` }}
                        />
                      </div>
                      <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{item.resumen.count}</span>
                    </div>
                  </div>
                );
                return item.href ? (
                  <Link key={item.label} href={item.href} className="-mx-1 rounded-lg px-1 transition-colors hover:bg-muted/40">
                    {contenido}
                  </Link>
                ) : (
                  <div key={item.label}>{contenido}</div>
                );
              })}
            </CardContent>
            {tasaCierre !== null && (
              <CardFooter className="text-xs text-muted-foreground">
                {/* CardFooter es flex -- un texto+span+texto sueltos como hijos
                    directos de un flex container pierden los espacios en los
                    bordes de cada nodo (cada uno se vuelve su propio flex
                    item). Envolverlo en un span normal evita ese recorte. */}
                <span>
                  Tasa de cierre <span className="font-mono text-foreground">{tasaCierre}%</span> (convertidas vs. perdidas)
                </span>
              </CardFooter>
            )}
          </Card>

          <Card className="gap-0">
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-medium">Servicios por status</CardTitle>
              <p className="text-xs text-muted-foreground">{totalServicios} servicios registrados</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {serviciosPorStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay servicios registrados.</p>
              ) : (
                <>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                    {STATUS_SERVICIO_ORDEN.filter((status) => (serviciosPorStatus.find((s) => s.status === status)?._count ?? 0) > 0).map(
                      (status) => (
                        <div
                          key={status}
                          className={SERVICIO_STATUS_BAR[status] ?? "bg-muted-foreground"}
                          style={{
                            width: `${((serviciosPorStatus.find((s) => s.status === status)?._count ?? 0) / totalServicios) * 100}%`,
                          }}
                        />
                      )
                    )}
                  </div>
                  <div className="flex flex-col divide-y">
                    {STATUS_SERVICIO_ORDEN.map((status) => {
                      const count = serviciosPorStatus.find((s) => s.status === status)?._count ?? 0;
                      return (
                        <Link
                          key={status}
                          href={`/admin/servicios?status=${status}`}
                          className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs transition-colors hover:bg-muted/40"
                        >
                          <span className={`size-2 rounded-sm ${SERVICIO_STATUS_BAR[status] ?? "bg-muted-foreground"}`} />
                          <span className="flex-1">{STATUS_SERVICIO_LABEL[status] ?? status}</span>
                          <span className="font-mono font-semibold">{count}</span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="gap-0">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b">
          <div>
            <CardTitle className="text-sm font-medium">Entradas y salidas del mes</CardTitle>
            <p className="text-xs text-muted-foreground">Ventas por origen y gastos por ámbito</p>
          </div>
          <Link href="/admin/reportes" className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
            Abrir reportes <ChevronRight className="size-3.5" />
          </Link>
        </CardHeader>
        <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <Link href="/admin/ventas?origen=TiendaOnline" className="flex flex-col p-4 transition-colors hover:bg-muted/30 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShoppingBag className="size-3.5" />
              </span>
              <span className="text-xs text-muted-foreground">Tienda online</span>
            </div>
            <div className="mt-3 font-mono text-xl font-semibold tabular-nums">{currencyCorta.format(ventasTiendaOnlineMXN)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ventasTiendaOnline?._count ?? 0} venta{(ventasTiendaOnline?._count ?? 0) === 1 ? "" : "s"} · ticket prom.{" "}
              {currencyCorta.format(ticketProm(ventasTiendaOnlineMXN, ventasTiendaOnline?._count ?? 0))}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${ventasTotalMXN > 0 ? (ventasTiendaOnlineMXN / ventasTotalMXN) * 100 : 0}%` }} />
            </div>
          </Link>
          <Link href="/admin/ventas?origen=Manual" className="flex flex-col p-4 transition-colors hover:bg-muted/30 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Handshake className="size-3.5" />
              </span>
              <span className="text-xs text-muted-foreground">Manual / otros medios</span>
            </div>
            <div className="mt-3 font-mono text-xl font-semibold tabular-nums">{currencyCorta.format(ventasManualMXN)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ventasManual?._count ?? 0} venta{(ventasManual?._count ?? 0) === 1 ? "" : "s"} · ticket prom.{" "}
              {currencyCorta.format(ticketProm(ventasManualMXN, ventasManual?._count ?? 0))}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${ventasTotalMXN > 0 ? (ventasManualMXN / ventasTotalMXN) * 100 : 0}%` }}
              />
            </div>
          </Link>
          <Link href="/admin/gastos?ambito=Empresa" className="flex flex-col p-4 transition-colors hover:bg-muted/30 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Wallet className="size-3.5" />
              </span>
              <span className="text-xs text-muted-foreground">Gasto de empresa</span>
            </div>
            <div className="mt-3 font-mono text-xl font-semibold tabular-nums">{currencyCorta.format(gastosEmpresaMXN)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {gastosEmpresa?._count ?? 0} gasto{(gastosEmpresa?._count ?? 0) === 1 ? "" : "s"} · sí afecta margen
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${gastoTotalMXN > 0 ? (gastosEmpresaMXN / gastoTotalMXN) * 100 : 0}%` }} />
            </div>
          </Link>
          <Link href="/admin/gastos?ambito=Personal" className="flex flex-col p-4 transition-colors hover:bg-muted/30 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <User className="size-3.5" />
              </span>
              <span className="text-xs text-muted-foreground">Gasto personal</span>
            </div>
            <div className="mt-3 font-mono text-xl font-semibold tabular-nums">{currencyCorta.format(gastosPersonalMXN)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {gastosPersonal?._count ?? 0} gasto{(gastosPersonal?._count ?? 0) === 1 ? "" : "s"} · no afecta margen
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${gastoTotalMXN > 0 ? (gastosPersonalMXN / gastoTotalMXN) * 100 : 0}%` }}
              />
            </div>
          </Link>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        {totalServicios} servicios registrados · {totalClientes} clientes · {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"} abierto
        {pendientes.length === 1 ? "" : "s"}
      </p>
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
