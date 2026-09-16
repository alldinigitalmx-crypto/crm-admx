import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Ticket,
  Percent,
  Clock,
  Hammer,
  Repeat,
  Target,
  Coins,
  ChartPie,
  CalendarClock,
  PiggyBank,
  Info,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import { requiereAdmin } from "@/lib/alcance";
import { prisma } from "@/lib/prisma";
import { hoyEnMexico } from "@/lib/fecha";
import { construirRangoFecha, rangoEfectivo } from "@/lib/reportes";
import { montoNetoEnMXN, montoEnMXN } from "@/lib/pago-monto";
import {
  resumenTicket,
  calcularTasaConversion,
  calcularTiempoCierrePromedio,
  calcularTiempoDesarrolloPromedio,
  calcularClientesRecurrentes,
  calcularIngresoPorCliente,
  calcularConcentracion,
  calcularIngresoMensualPromedio,
  calcularMargen,
  bucketsTicket,
  agruparIngresoPorOrigen,
  agruparTicketTipicoPorMes,
} from "@/lib/kpis";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DesgloseBarras, type ItemBarra } from "@/components/reportes/desglose-barras";
import { DonutChart, type DonutItem } from "@/components/reportes/donut-chart";
import type { Prisma } from "@/generated/prisma/client";

const ORIGEN_LABEL: Record<string, string> = {
  FacebookAds: "Facebook Ads",
  Grupo: "Grupo",
  Intermediario: "Intermediario",
  Otro: "Otro",
  "Sin origen": "Sin origen",
};
const ORIGEN_COLOR_HEX: Record<string, string> = {
  FacebookAds: "#2563eb",
  Grupo: "#059669",
  Intermediario: "#8b5cf6",
  Otro: "#f59e0b",
  "Sin origen": "#71717a",
};
const ORIGEN_COLOR_BG: Record<string, string> = {
  FacebookAds: "bg-blue-600 dark:bg-blue-400",
  Grupo: "bg-emerald-600 dark:bg-emerald-400",
  Intermediario: "bg-violet-500 dark:bg-violet-400",
  Otro: "bg-amber-500 dark:bg-amber-400",
  "Sin origen": "bg-zinc-400 dark:bg-zinc-500",
};

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Etiqueta de sección tipo "eyebrow" con línea -- agrupa las tarjetas por
// la pregunta de negocio que responden en vez de un solo grid plano.
function Divisor({ label }: { label: string }) {
  return (
    <div className="mt-1 flex items-baseline gap-2.5">
      <span className="shrink-0 text-[11px] font-semibold tracking-wider text-foreground/70">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// Tarjeta base para las métricas de una sola cifra -- ícono, etiqueta,
// valor grande en mono, sub-texto y un pie opcional (barra, comparación,
// nota) separado por una línea, igual que en el resto de las tarjetas
// del rediseño de Reportes.
function StatCard({
  icon: Icon,
  iconTone = "text-primary",
  label,
  value,
  unit,
  valueClassName,
  sub,
  href,
  hrefLabel,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconTone?: string;
  label: string;
  value: string;
  unit?: string;
  valueClassName?: string;
  sub?: string;
  href?: string;
  hrefLabel?: string;
  children?: React.ReactNode;
}) {
  const contenido = (
    <Card className={`min-w-0 ${href ? "h-full transition-colors hover:bg-muted/30" : "h-full"}`}>
      <CardContent className="flex h-full min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={`size-[15px] shrink-0 ${iconTone}`} />
            <span className="truncate text-[12.5px] font-medium text-muted-foreground">{label}</span>
          </div>
          {href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-3 flex min-w-0 items-baseline gap-2">
          <span
            className={`min-w-0 truncate font-mono text-[26px] leading-none font-semibold tracking-tight ${valueClassName ?? ""}`}
          >
            {value}
          </span>
          {unit && (
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{unit}</span>
          )}
        </div>
        {sub && <p className="mt-2.5 text-[11.5px] text-muted-foreground">{sub}</p>}
        <div className="flex-1" />
        {children && <div className="mt-2.5 border-t border-border pt-2.5">{children}</div>}
        {href && (
          <p className="mt-2.5 text-[11.5px] font-medium text-primary">{hrefLabel ?? "Ver detalle"}</p>
        )}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {contenido}
    </Link>
  ) : (
    contenido
  );
}

// Barras verticales simples (SVG-free, solo divs) para "ticket típico por
// mes" -- a propósito distinto de DesgloseBarras (que es horizontal, para
// desgloses categóricos): esto es una serie en el tiempo, no una
// categoría, y verlo como columnas es lo que de verdad se lee como
// tendencia mes a mes.
function BarrasVerticales({ items }: { items: { label: string; valor: number; activo?: boolean }[] }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  return (
    <div className="flex items-end gap-1.5" style={{ height: 130 }}>
      {items.map((item) => (
        <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              className={`w-full max-w-6 rounded-t ${item.activo ? "bg-primary/50" : "bg-primary"}`}
              style={{ height: item.valor > 0 ? `${Math.max(3, (item.valor / max) * 100)}%` : 2 }}
              title={formatCurrency(item.valor)}
            />
          </div>
          <span
            className={`text-[10px] ${item.activo ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; todo?: string }>;
}) {
  if (!(await requiereAdmin())) redirect("/admin");

  const { desde, hasta, todo } = await searchParams;

  if (!desde && !hasta && todo !== "1") {
    const hoyDefault = hoyEnMexico();
    const inicioMesDefault = new Date(Date.UTC(hoyDefault.getUTCFullYear(), hoyDefault.getUTCMonth(), 1));
    redirect(`/admin/kpis?desde=${isoDate(inicioMesDefault)}&hasta=${isoDate(hoyDefault)}`);
  }

  const [minServicio] = await Promise.all([
    prisma.servicio.aggregate({ _min: { fechaInicio: true } }),
  ]);
  const { desde: desdeEfectivo, hasta: hastaEfectivo } = rangoEfectivo(
    todo === "1" ? undefined : desde,
    todo === "1" ? undefined : hasta,
    minServicio._min.fechaInicio
  );
  const rango = construirRangoFecha(todo === "1" ? undefined : desde, todo === "1" ? undefined : hasta);

  const whereServiciosNuevos: Prisma.ServicioWhereInput = rango ? { fechaInicio: rango } : {};
  const whereCotizacionesEmitidas: Prisma.CotizacionWhereInput = rango ? { fechaEmision: rango } : {};
  const whereCotizacionesCerradas: Prisma.CotizacionWhereInput = rango
    ? { fechaFirma: { ...rango, not: null } }
    : { fechaFirma: { not: null } };
  const whereServiciosEntregados: Prisma.ServicioWhereInput = rango
    ? { status: "Entregado", fechaFin: rango }
    : { status: "Entregado", fechaFin: { not: null } };
  const wherePagos: Prisma.PagoWhereInput = { confirmado: true, ...(rango ? { fecha: rango } : {}) };

  const [
    serviciosNuevos,
    cotizacionesEmitidas,
    cotizacionesCerradas,
    serviciosEntregados,
    clientes,
    pagosConOrigen,
    prospectosActivos,
    gastosEmpresaSum,
  ] = await Promise.all([
    prisma.servicio.findMany({
      where: whereServiciosNuevos,
      select: {
        fechaInicio: true,
        pagos: {
          where: { confirmado: true },
          select: { monto: true, moneda: true, montoMXN: true },
        },
      },
    }),
    prisma.cotizacion.findMany({ where: whereCotizacionesEmitidas, select: { status: true } }),
    prisma.cotizacion.findMany({
      where: whereCotizacionesCerradas,
      select: { fechaEmision: true, fechaFirma: true },
    }),
    prisma.servicio.findMany({
      where: whereServiciosEntregados,
      select: { fechaInicio: true, fechaFin: true },
    }),
    prisma.cliente.findMany({ select: { _count: { select: { servicios: true } } } }),
    prisma.pago.findMany({
      where: wherePagos,
      select: {
        monto: true,
        moneda: true,
        montoMXN: true,
        comision: true,
        montoIncluyeComision: true,
        servicio: { select: { cliente: { select: { id: true, medioCaptacion: true } } } },
      },
    }),
    prisma.cliente.count({
      where: {
        OR: [
          { etiqueta: "Prospecto" },
          { cotizaciones: { some: { status: { in: ["Enviada", "Firmada"] }, servicioId: null } } },
          { tareas: { some: { completada: false } } },
        ],
      },
    }),
    prisma.gasto.aggregate({
      _sum: { monto: true },
      where: { ambito: "Empresa", ...(rango ? { fecha: rango } : {}) },
    }),
  ]);

  const montoServicioAMXN = (s: { pagos: { monto: unknown; moneda: string | null; montoMXN: unknown }[] }) =>
    s.pagos.reduce((acc, p) => acc + montoEnMXN(p as Parameters<typeof montoEnMXN>[0]), 0);

  const montosServiciosPagados = serviciosNuevos.map(montoServicioAMXN).filter((m) => m > 0);
  const ticket = resumenTicket(montosServiciosPagados);
  const conversion = calcularTasaConversion(cotizacionesEmitidas.map((c) => c.status));
  const cierre = calcularTiempoCierrePromedio(cotizacionesCerradas);
  const desarrollo = calcularTiempoDesarrolloPromedio(
    serviciosEntregados.filter((s): s is { fechaInicio: Date; fechaFin: Date } => s.fechaFin !== null)
  );
  const recurrentes = calcularClientesRecurrentes(clientes.map((c) => c._count.servicios));

  const recaudadoPorCliente = new Map<number, number>();
  for (const p of pagosConOrigen) {
    const id = p.servicio.cliente.id;
    recaudadoPorCliente.set(id, (recaudadoPorCliente.get(id) ?? 0) + montoNetoEnMXN(p));
  }
  const montosPorCliente = Array.from(recaudadoPorCliente.values());
  const totalRecaudadoRango = montosPorCliente.reduce((acc, v) => acc + v, 0);
  const gastosEmpresaRango = Number(gastosEmpresaSum._sum.monto ?? 0);

  const ingresoPorCliente = calcularIngresoPorCliente(montosPorCliente);
  const concentracion = calcularConcentracion(montosPorCliente);
  const ingresoMensual = calcularIngresoMensualPromedio(totalRecaudadoRango, desdeEfectivo, hastaEfectivo);
  const margen = calcularMargen(totalRecaudadoRango, gastosEmpresaRango);
  const distribucionTicket = bucketsTicket(montosServiciosPagados);

  const ingresoPorOrigen = agruparIngresoPorOrigen(
    pagosConOrigen.map((p) => ({
      montoMXN: montoNetoEnMXN(p),
      origen: p.servicio.cliente.medioCaptacion,
    }))
  );
  const ticketPorMes = agruparTicketTipicoPorMes(
    serviciosNuevos
      .map((s) => ({ fecha: s.fechaInicio, montoMXN: montoServicioAMXN(s) }))
      .filter((x) => x.montoMXN > 0),
    desdeEfectivo,
    hastaEfectivo
  );

  const totalOrigen = ingresoPorOrigen.reduce((acc, o) => acc + o.montoMXN, 0);

  const distribucionItems: ItemBarra[] = distribucionTicket.map((b) => ({
    label: b.label,
    valor: b.count,
    detalle: `${b.count} servicio${b.count === 1 ? "" : "s"}`,
    colorClass: "bg-primary",
  }));

  const utilidadRango = totalRecaudadoRango - gastosEmpresaRango;

  // Meses que abarca el rango (mismo criterio que calcularIngresoMensualPromedio,
  // solo que aquí lo queremos mostrar tal cual en vez de solo dividir con él).
  const mesesRango = Math.max(
    1,
    (hastaEfectivo.getFullYear() - desdeEfectivo.getFullYear()) * 12 +
      (hastaEfectivo.getMonth() - desdeEfectivo.getMonth()) +
      (hastaEfectivo.getDate() - desdeEfectivo.getDate() + 1) / 30
  );

  // Clasificación de riesgo por concentración -- sin un estándar de la
  // industria fijo, se usa el mismo criterio que ya insinúa el propio
  // texto de ayuda ("arriba de 70% conviene diversificar" sobre el top 3).
  const riesgo: "bajo" | "medio" | "alto" =
    concentracion.topPct >= 55 ? "alto" : concentracion.topPct >= 35 ? "medio" : "bajo";
  const riesgoEstilo = {
    bajo: "bg-success/10 text-success",
    medio: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    alto: "bg-destructive/10 text-destructive",
  }[riesgo];

  const hoy = hoyEnMexico();
  const hoyIso = isoDate(hoy);
  const hace7 = new Date(hoy);
  hace7.setUTCDate(hace7.getUTCDate() - 6);
  const hace30 = new Date(hoy);
  hace30.setUTCDate(hace30.getUTCDate() - 29);
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const inicioAno = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));

  const presets = [
    { label: "Hoy", desde: hoyIso, hasta: hoyIso, todo: false },
    { label: "7 días", desde: isoDate(hace7), hasta: hoyIso, todo: false },
    { label: "30 días", desde: isoDate(hace30), hasta: hoyIso, todo: false },
    { label: "Este mes", desde: isoDate(inicioMes), hasta: hoyIso, todo: false },
    { label: "Este año", desde: isoDate(inicioAno), hasta: hoyIso, todo: false },
    { label: "Todo", desde: undefined, hasta: undefined, todo: true },
  ];
  const presetActivo =
    todo === "1" ? presets[5] : (presets.find((p) => !p.todo && p.desde === desde && p.hasta === hasta) ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold">KPIs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Métricas que no salen en Reportes ni en el Panel — un ángulo distinto del negocio.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">RANGO ACTIVO</div>
          <div className="mt-0.5 font-mono text-[13px]">
            {formatDate(desdeEfectivo)} — {formatDate(hastaEfectivo)}
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
            {mesesRango.toFixed(1)} meses · {ingresoPorCliente.count} cliente
            {ingresoPorCliente.count === 1 ? "" : "s"} pagaron
          </div>
        </div>
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="w-16 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground">
            PERIODO
          </span>
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
            {presets.map((p) => {
              const params = new URLSearchParams();
              if (p.todo) params.set("todo", "1");
              else {
                if (p.desde) params.set("desde", p.desde);
                if (p.hasta) params.set("hasta", p.hasta);
              }
              const href = `/admin/kpis?${params}`;
              const activo = presetActivo?.label === p.label;
              return (
                <Link
                  key={p.label}
                  href={href}
                  className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs transition-colors ${
                    activo
                      ? "bg-card font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
          <form className="ml-auto flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="desde" className="text-[11px] text-muted-foreground">
                Desde
              </label>
              <Input id="desde" type="date" name="desde" defaultValue={desde ?? ""} className="h-8 w-[150px]" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="hasta" className="text-[11px] text-muted-foreground">
                Hasta
              </label>
              <Input id="hasta" type="date" name="hasta" defaultValue={hasta ?? ""} className="h-8 w-[150px]" />
            </div>
            <Button type="submit" size="sm">
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Divisor label="CUÁNTO ENTRA" />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarClock}
          label="Ingreso mensual promedio"
          value={formatCurrency(ingresoMensual)}
          sub="Recaudado ÷ meses del rango (run rate)"
        >
          <p className="text-[11.5px] text-muted-foreground">
            <span className="font-mono text-foreground">{formatCurrency(totalRecaudadoRango)}</span> recaudado en{" "}
            {mesesRango.toFixed(1)} meses
          </p>
        </StatCard>

        <StatCard
          icon={Ticket}
          label="Ticket típico"
          value={formatCurrency(ticket.mediana)}
          unit="MEDIANA"
          sub={
            ticket.count > 0
              ? `Promedio ${formatCurrency(ticket.promedio)} · ${ticket.count} servicio${
                  ticket.count === 1 ? "" : "s"
                } con pagos`
              : "Sin servicios nuevos con pagos en el rango"
          }
        >
          {ticket.count > 0 && ticket.max > ticket.min && (
            <div>
              <div className="relative h-1.5 rounded-full bg-muted">
                <div className="absolute inset-x-[5%] top-0 bottom-0 rounded-full bg-primary/30" />
                <div
                  className="absolute top-1/2 h-2.5 w-1 -translate-y-1/2 rounded-sm bg-primary"
                  style={{
                    left: `${5 + ((ticket.mediana - ticket.min) / (ticket.max - ticket.min)) * 90}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-muted-foreground">
                <span>{formatCurrency(ticket.min)}</span>
                <span>{formatCurrency(ticket.max)}</span>
              </div>
            </div>
          )}
        </StatCard>

        <StatCard
          icon={Coins}
          label="Ingreso por cliente"
          value={formatCurrency(ingresoPorCliente.promedio)}
          unit="PROMEDIO"
          sub={
            ingresoPorCliente.count > 0
              ? `Mediana ${formatCurrency(ingresoPorCliente.mediana)} · ${
                  ingresoPorCliente.count
                } cliente${ingresoPorCliente.count === 1 ? "" : "s"} pagaron`
              : "Ningún cliente pagó en el rango"
          }
        >
          {ingresoPorCliente.count > 1 && ingresoPorCliente.promedio > ingresoPorCliente.mediana * 1.15 && (
            <p className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              El promedio va arriba de la mediana: pocos clientes grandes
            </p>
          )}
        </StatCard>

        <StatCard
          icon={PiggyBank}
          iconTone="text-success"
          label="Margen de utilidad"
          value={`${margen.toFixed(0)}%`}
          valueClassName={margen >= 0 ? "text-success" : "text-destructive"}
          sub="Utilidad neta ÷ recaudado (solo empresa)"
        >
          {totalRecaudadoRango > 0 && (
            <div>
              <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                <div
                  className={`h-full ${utilidadRango >= 0 ? "bg-success" : "bg-destructive"}`}
                  style={{ width: `${Math.min(100, Math.max(0, margen))}%` }}
                />
                <div className="h-full flex-1 bg-muted" />
              </div>
              <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
                <span>
                  Utilidad <span className="font-mono">{formatCurrency(utilidadRango)}</span>
                </span>
                <span>
                  Gasto <span className="font-mono">{formatCurrency(gastosEmpresaRango)}</span>
                </span>
              </div>
            </div>
          )}
        </StatCard>
      </div>

      <Divisor label="QUÉ TAN RÁPIDO SE CIERRA Y SE ENTREGA" />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Percent}
          label="Tasa de conversión"
          value={`${conversion.pct.toFixed(0)}%`}
          sub={`${conversion.ganadas} de ${conversion.total} cotizaciones emitidas se firmaron`}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, conversion.pct)}%` }} />
          </div>
        </StatCard>

        <StatCard
          icon={Clock}
          label="Tiempo promedio de cierre"
          value={cierre.count > 0 ? cierre.dias.toFixed(1) : "—"}
          unit={cierre.count > 0 ? "días" : undefined}
          sub={
            cierre.count > 0
              ? `De emitida a firmada, ${cierre.count} cotizaci${cierre.count === 1 ? "ón" : "ones"}`
              : "Sin cotizaciones firmadas en el rango"
          }
        />

        <StatCard
          icon={Hammer}
          label="Tiempo promedio de desarrollo"
          value={desarrollo.count > 0 ? desarrollo.dias.toFixed(1) : "—"}
          unit={desarrollo.count > 0 ? "días" : undefined}
          sub={
            desarrollo.count > 0
              ? `De inicio a entrega, ${desarrollo.count} servicio${desarrollo.count === 1 ? "" : "s"}`
              : "Sin servicios entregados en el rango"
          }
        >
          {desarrollo.count > 0 && (
            <p className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Solo servicios ya entregados
            </p>
          )}
        </StatCard>

        <StatCard
          icon={Target}
          iconTone="text-violet-500"
          label="Prospectos activos"
          value={String(prospectosActivos)}
          sub="En el embudo ahora mismo"
          href="/admin/prospectos"
          hrefLabel="Abrir Prospectos"
        />
      </div>

      <Divisor label="DE QUIÉN DEPENDE EL NEGOCIO" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ChartPie className="size-[15px] text-amber-600 dark:text-amber-400" />
                  <span className="text-[12.5px] font-medium text-muted-foreground">Concentración de clientes</span>
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[26px] leading-none font-semibold tracking-tight">
                    {concentracion.topPct.toFixed(0)}%
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">del ingreso viene de tu cliente más grande</span>
                </div>
              </div>
              {concentracion.total > 0 && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${riesgoEstilo}`}
                >
                  {riesgo === "alto" ? <ShieldAlert className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                  Riesgo {riesgo}
                </span>
              )}
            </div>

            {concentracion.total > 0 ? (
              <div className="mt-4">
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                  <div className="h-full bg-primary" style={{ width: `${concentracion.topPct}%` }} />
                  <div
                    className="h-full bg-primary/50"
                    style={{ width: `${Math.max(0, concentracion.top3Pct - concentracion.topPct)}%` }}
                  />
                  <div className="h-full flex-1 bg-muted" />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-4 text-[11.5px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-primary" />
                    Cliente #1 · <span className="font-mono text-foreground">{concentracion.topPct.toFixed(0)}%</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-primary/50" />
                    Resto del top 3 ·{" "}
                    <span className="font-mono text-foreground">
                      {Math.max(0, concentracion.top3Pct - concentracion.topPct).toFixed(0)}%
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-muted" />
                    Otros clientes ·{" "}
                    <span className="font-mono text-foreground">{(100 - concentracion.top3Pct).toFixed(0)}%</span>
                  </span>
                </div>
                <p className="mt-2.5 border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">
                  Top 3 = {concentracion.top3Pct.toFixed(0)}% del ingreso. Arriba de 70% conviene diversificar.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Sin ingreso en el rango.</p>
            )}
          </CardContent>
        </Card>

        <StatCard
          icon={Repeat}
          iconTone="text-success"
          label="Clientes recurrentes"
          value={`${recurrentes.pct.toFixed(0)}%`}
          sub={`${recurrentes.recurrentes} de ${recurrentes.total} clientes — histórico, no depende del rango`}
        >
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <div className="h-full bg-success" style={{ width: `${Math.max(2, recurrentes.pct)}%` }} />
            <div className="h-full flex-1 bg-muted" />
          </div>
          <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
            <span>Con 2+ servicios</span>
            <span>Un solo servicio</span>
          </div>
        </StatCard>
      </div>

      <Divisor label="DESGLOSES" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardContent>
            <div className="border-b border-border pb-3.5">
              <p className="text-sm font-semibold">Ingreso por origen de cliente</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                De dónde viene el dinero que entra — no cómo lo pagaron (eso ya está en Reportes).
              </p>
            </div>
            {ingresoPorOrigen.length === 0 ? (
              <p className="pt-4 text-sm text-muted-foreground">No hay pagos confirmados en este rango.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 pt-4">
                <DonutChart
                  items={ingresoPorOrigen.map<DonutItem>((o) => ({
                    label: ORIGEN_LABEL[o.origen] ?? o.origen,
                    value: o.montoMXN,
                    color: ORIGEN_COLOR_HEX[o.origen] ?? ORIGEN_COLOR_HEX.Otro,
                  }))}
                  centerLabel={formatCurrency(totalOrigen)}
                  centerSub="recaudado"
                  size={152}
                  thickness={20}
                />
                <div className="flex w-full flex-col">
                  {ingresoPorOrigen.map((o) => {
                    const pct = totalOrigen > 0 ? (o.montoMXN / totalOrigen) * 100 : 0;
                    const label = ORIGEN_LABEL[o.origen] ?? o.origen;
                    return (
                      <div key={o.origen} className="border-t border-border py-2.5 first:border-t-0">
                        <div className="flex items-baseline gap-2 text-[12.5px]">
                          <span
                            className={`size-2 shrink-0 rounded-sm ${ORIGEN_COLOR_BG[o.origen] ?? "bg-zinc-400"}`}
                          />
                          <span className="flex-1 truncate font-medium">{label}</span>
                          <span className="font-mono font-semibold">{formatCurrency(o.montoMXN)}</span>
                          <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
                            {o.count} pago{o.count === 1 ? "" : "s"}
                          </span>
                          <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1.5 ml-4 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${ORIGEN_COLOR_BG[o.origen] ?? "bg-zinc-400"}`}
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card>
            <CardContent>
              <div className="border-b border-border pb-3.5">
                <p className="text-sm font-semibold">Ticket típico por mes</p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Mediana del tamaño de los servicios nuevos, mes a mes — un contrato grande no dispara el
                  mes entero.
                </p>
              </div>
              {ticketPorMes.every((m) => m.count === 0) ? (
                <p className="pt-4 text-sm text-muted-foreground">No hay servicios nuevos en este rango.</p>
              ) : (
                <div className="pt-4">
                  <BarrasVerticales
                    items={ticketPorMes.map((m, i) => ({
                      label: m.label.split(" ")[0].toUpperCase(),
                      valor: m.mediana,
                      activo: i === ticketPorMes.length - 1,
                    }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="border-b border-border pb-3.5">
                <p className="text-sm font-semibold">Distribución de tickets</p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Cuántos servicios nuevos del rango cayeron en cada rango de tamaño — para ver si son
                  parejos o hay de todo.
                </p>
              </div>
              <div className="pt-4">
                <DesgloseBarras
                  items={distribucionItems}
                  formato="numero"
                  vacio="No hay servicios nuevos en este rango."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        Montos en MXN · ticket e ingreso por cliente usan pagos confirmados, no lo cotizado · clientes
        recurrentes es histórico
      </p>
    </div>
  );
}
