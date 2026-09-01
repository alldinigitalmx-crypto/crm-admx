import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket, Percent, Clock, Hammer, Repeat, Target } from "lucide-react";

import { requiereAdmin } from "@/lib/alcance";
import { prisma } from "@/lib/prisma";
import { hoyEnMexico } from "@/lib/fecha";
import { construirRangoFecha, rangoEfectivo } from "@/lib/reportes";
import { obtenerTasasAMXN } from "@/lib/tipo-cambio";
import { montoTotalServicio } from "@/lib/servicio";
import { montoNetoEnMXN } from "@/lib/pago-monto";
import {
  calcularTicketPromedio,
  calcularTasaConversion,
  calcularTiempoCierrePromedio,
  calcularTiempoDesarrolloPromedio,
  calcularClientesRecurrentes,
  agruparIngresoPorOrigen,
  agruparTicketPromedioPorMes,
} from "@/lib/kpis";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
const ORIGEN_COLOR: Record<string, string> = {
  FacebookAds: "bg-blue-600 dark:bg-blue-400",
  Grupo: "bg-emerald-600 dark:bg-emerald-400",
  Intermediario: "bg-violet-500 dark:bg-violet-400",
  Otro: "bg-zinc-400 dark:bg-zinc-500",
  "Sin origen": "bg-amber-500 dark:bg-amber-400",
};
const ORIGEN_COLOR_HEX: Record<string, string> = {
  FacebookAds: "#2563eb",
  Grupo: "#059669",
  Intermediario: "#8b5cf6",
  Otro: "#a1a1aa",
  "Sin origen": "#f59e0b",
};

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  href,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const contenido = (
    <Card className={href ? "transition-colors hover:bg-muted/40" : undefined}>
      <CardContent className="flex items-start gap-3 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{contenido}</Link> : contenido;
}

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; todo?: string }>;
}) {
  if (!(await requiereAdmin())) redirect("/admin");

  const { desde, hasta, todo } = await searchParams;

  // Mismo default y mismos presets que Reportes: sin filtro en la URL,
  // "Este mes" de entrada.
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
    tasas,
  ] = await Promise.all([
    prisma.servicio.findMany({
      where: whereServiciosNuevos,
      select: {
        fechaInicio: true,
        montoInicial: true,
        moneda: true,
        ordenesCambio: { select: { status: true, monto: true } },
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
    // Clientes recurrentes: histórico, no depende del rango (igual que
    // "Pendiente por recibir" en Reportes).
    prisma.cliente.findMany({ select: { _count: { select: { servicios: true } } } }),
    prisma.pago.findMany({
      where: wherePagos,
      select: {
        monto: true,
        moneda: true,
        montoMXN: true,
        comision: true,
        montoIncluyeComision: true,
        servicio: { select: { cliente: { select: { medioCaptacion: true } } } },
      },
    }),
    prisma.cliente.count({
      where: {
        OR: [
          { etiqueta: "Prospecto" },
          { cotizaciones: { some: { status: { in: ["Enviada", "Firmada"] }, servicioId: null } } },
        ],
      },
    }),
    obtenerTasasAMXN(),
  ]);

  const montoServicioAMXN = (s: { moneda: string | null; montoInicial: unknown; ordenesCambio: { status: string; monto: unknown }[] }) => {
    const moneda = s.moneda ?? "MXN";
    const total = montoTotalServicio(s as Parameters<typeof montoTotalServicio>[0]);
    if (moneda === "MXN") return total;
    const tasa = tasas[moneda as "USD" | "EUR"];
    return tasa ? total * tasa : null;
  };

  const ticket = calcularTicketPromedio(serviciosNuevos.map(montoServicioAMXN));
  const conversion = calcularTasaConversion(cotizacionesEmitidas.map((c) => c.status));
  const cierre = calcularTiempoCierrePromedio(cotizacionesCerradas);
  const desarrollo = calcularTiempoDesarrolloPromedio(
    serviciosEntregados.filter((s): s is { fechaInicio: Date; fechaFin: Date } => s.fechaFin !== null)
  );
  const recurrentes = calcularClientesRecurrentes(clientes.map((c) => c._count.servicios));

  const ingresoPorOrigen = agruparIngresoPorOrigen(
    pagosConOrigen.map((p) => ({
      montoMXN: montoNetoEnMXN(p),
      origen: p.servicio.cliente.medioCaptacion,
    }))
  );
  const ticketPorMes = agruparTicketPromedioPorMes(
    serviciosNuevos.map((s) => ({ fecha: s.fechaInicio, montoMXN: montoServicioAMXN(s) })),
    desdeEfectivo,
    hastaEfectivo
  );

  const origenItems: ItemBarra[] = ingresoPorOrigen.map((o) => ({
    label: ORIGEN_LABEL[o.origen] ?? o.origen,
    valor: o.montoMXN,
    detalle: `${o.count} pago${o.count === 1 ? "" : "s"}`,
    colorClass: ORIGEN_COLOR[o.origen] ?? "bg-zinc-400 dark:bg-zinc-500",
  }));
  const origenDonut: DonutItem[] = ingresoPorOrigen.map((o) => ({
    label: ORIGEN_LABEL[o.origen] ?? o.origen,
    value: o.montoMXN,
    color: ORIGEN_COLOR_HEX[o.origen] ?? "#a1a1aa",
  }));
  const totalOrigen = ingresoPorOrigen.reduce((acc, o) => acc + o.montoMXN, 0);

  const ticketMesItems: ItemBarra[] = ticketPorMes.map((m) => ({
    label: m.label,
    valor: m.promedio,
    detalle: m.count > 0 ? `${m.count} servicio${m.count === 1 ? "" : "s"}` : "Sin servicios nuevos",
    colorClass: "bg-primary",
  }));

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
      <div>
        <h1 className="text-2xl font-semibold">KPIs</h1>
        <p className="text-sm text-muted-foreground">
          Métricas que no salen en Reportes ni en el Panel — un ángulo distinto del negocio.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Rango de fechas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const params = new URLSearchParams();
              if (p.todo) {
                params.set("todo", "1");
              } else {
                if (p.desde) params.set("desde", p.desde);
                if (p.hasta) params.set("hasta", p.hasta);
              }
              const href = `/admin/kpis?${params}`;
              const activo = presetActivo?.label === p.label;
              return (
                <Button key={p.label} asChild size="sm" variant={activo ? "default" : "outline"}>
                  <Link href={href}>{p.label}</Link>
                </Button>
              );
            })}
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="desde" className="text-xs text-muted-foreground">
                Desde
              </label>
              <Input id="desde" type="date" name="desde" defaultValue={desde ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="hasta" className="text-xs text-muted-foreground">
                Hasta
              </label>
              <Input id="hasta" type="date" name="hasta" defaultValue={hasta ?? ""} />
            </div>
            <Button type="submit" className="self-end">
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Ticket promedio"
          value={formatCurrency(ticket.promedio)}
          sub={
            ticket.excluidos > 0
              ? `${ticket.count} servicios nuevos (${ticket.excluidos} sin convertir de moneda)`
              : `${ticket.count} servicios nuevos en el rango`
          }
          icon={Ticket}
        />
        <KpiCard
          title="Tasa de conversión"
          value={`${conversion.pct.toFixed(0)}%`}
          sub={`${conversion.ganadas} de ${conversion.total} cotizaciones emitidas se firmaron`}
          icon={Percent}
        />
        <KpiCard
          title="Tiempo promedio de cierre"
          value={cierre.count > 0 ? `${cierre.dias.toFixed(1)} días` : "—"}
          sub={
            cierre.count > 0
              ? `De emitida a firmada, ${cierre.count} cotización${cierre.count === 1 ? "" : "es"}`
              : "Sin cotizaciones firmadas en el rango"
          }
          icon={Clock}
        />
        <KpiCard
          title="Tiempo promedio de desarrollo"
          value={desarrollo.count > 0 ? `${desarrollo.dias.toFixed(1)} días` : "—"}
          sub={
            desarrollo.count > 0
              ? `De inicio a entrega, ${desarrollo.count} servicio${desarrollo.count === 1 ? "" : "s"}`
              : "Sin servicios entregados en el rango"
          }
          icon={Hammer}
        />
        <KpiCard
          title="Clientes recurrentes"
          value={`${recurrentes.pct.toFixed(0)}%`}
          sub={`${recurrentes.recurrentes} de ${recurrentes.total} clientes — histórico, no depende del rango`}
          icon={Repeat}
        />
        <KpiCard
          title="Prospectos activos"
          value={String(prospectosActivos)}
          sub="En el embudo ahora mismo — ver detalle"
          icon={Target}
          href="/admin/prospectos"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ingreso por origen de cliente</CardTitle>
            <CardDescription className="text-xs">
              De dónde viene el dinero que entra — no cómo lo pagaron (eso ya está en Reportes).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {origenItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pagos confirmados en este rango.</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <DonutChart items={origenDonut} centerLabel={formatCurrency(totalOrigen)} centerSub="recaudado" />
                <DesgloseBarras items={origenItems} vacio="No hay pagos confirmados en este rango." />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ticket promedio por mes</CardTitle>
            <CardDescription className="text-xs">
              Tamaño promedio de los servicios nuevos, mes a mes dentro del rango.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DesgloseBarras items={ticketMesItems} vacio="No hay servicios nuevos en este rango." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
