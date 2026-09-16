import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Briefcase,
  CheckCircle2,
  Users,
  Download,
  FileDown,
  User,
  ArrowUp,
  ArrowDown,
  Filter,
  Calendar,
  GitCompare,
  Receipt,
  ArrowRight,
} from "lucide-react";

import { requiereAdmin } from "@/lib/alcance";
import { formatCurrency, formatDate } from "@/lib/format";
import { obtenerDatosReportes } from "@/lib/reportes-data";
import { calcularDelta, type Delta, type ModoComparacion } from "@/lib/reportes";
import { hoyEnMexico } from "@/lib/fecha";
import { DetalleDialog } from "@/components/reportes/detalle-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecaudadoGastosChart } from "@/components/reportes/recaudado-gastos-chart";
import { DesgloseBarras, type ItemBarra } from "@/components/reportes/desglose-barras";
import { DonutChart, type DonutItem } from "@/components/reportes/donut-chart";
import { SERVICIO_STATUS_COLOR } from "@/lib/status-colors";
import type { StatusServicio } from "@/generated/prisma/client";

const METODO_COLOR_HEX: Record<string, string> = {
  Efectivo: "#10b981",
  Transferencia: "#6366f1",
  "Mercado Pago": "#0ea5e9",
  PayPal: "#8b5cf6",
  Tarjeta: "#ec4899",
  "Western Union": "#f59e0b",
  Binance: "#f97316",
  Depósito: "#14b8a6",
  "Spin by OXXO": "#dc2626",
  Otro: "#a1a1aa",
};

const STATUS_COLOR: Record<StatusServicio, string> = {
  Cotizado: "bg-slate-400 dark:bg-slate-500",
  Aprobado: "bg-blue-600 dark:bg-blue-400",
  EnProceso: "bg-amber-500 dark:bg-amber-400",
  Entregado: "bg-emerald-600 dark:bg-emerald-400",
  Cancelado: "bg-red-500 dark:bg-red-400",
};
const STATUS_LABEL: Record<StatusServicio, string> = {
  Cotizado: "Cotizado",
  Aprobado: "Aprobado",
  EnProceso: "En proceso",
  Entregado: "Entregado",
  Cancelado: "Cancelado",
};

const METODO_COLOR: Record<string, string> = {
  Efectivo: "bg-emerald-600 dark:bg-emerald-400",
  Transferencia: "bg-blue-600 dark:bg-blue-400",
  "Mercado Pago": "bg-sky-500 dark:bg-sky-400",
  PayPal: "bg-violet-500 dark:bg-violet-400",
  Tarjeta: "bg-pink-500 dark:bg-pink-400",
  "Western Union": "bg-amber-500 dark:bg-amber-400",
  Binance: "bg-orange-500 dark:bg-orange-400",
  Depósito: "bg-teal-500 dark:bg-teal-400",
  "Spin by OXXO": "bg-red-600 dark:bg-red-400",
  Otro: "bg-zinc-400 dark:bg-zinc-500",
};
const COLOR_OTROS = "bg-zinc-400 dark:bg-zinc-500";
const CATEGORICOS_GASTO = [
  "bg-blue-600 dark:bg-blue-400",
  "bg-orange-500 dark:bg-orange-400",
  "bg-teal-500 dark:bg-teal-400",
  "bg-amber-500 dark:bg-amber-400",
  "bg-pink-500 dark:bg-pink-400",
];

const AVATAR_TONOS = [
  "bg-primary/10 text-primary",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-sky-500/15 text-sky-700 dark:text-sky-400",
];

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? `${partes[0][0]}${partes[1][0]}` : (partes[0]?.slice(0, 2) ?? "?");
  return letras.toUpperCase();
}

function tonoAvatar(id: number) {
  return AVATAR_TONOS[id % AVATAR_TONOS.length];
}

// Segmento de pills tipo "segmented control" para navegar por Link (no
// hay estado de cliente -- cada opción es su propio href con el query
// ya armado) -- mismo patrón que los presets de antes, solo que con el
// look de un selector de un solo grupo.
function PillGroup({ items }: { items: { label: string; href: string; activo: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs transition-colors ${
            item.activo
              ? "bg-card font-semibold text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

// Badge de variación vs. el periodo de comparación -- mismo criterio de
// "bueno" que antes (verde cuando el cambio va a favor de esa métrica),
// pero como pastilla compacta para vivir junto a la cifra grande.
function DeltaPill({ delta, buenoCuando }: { delta: Delta; buenoCuando: "up" | "down" }) {
  if (delta.dir === "flat") {
    return (
      <span className="mb-0.5 inline-flex h-5 shrink-0 items-center rounded-md bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
        sin cambio
      </span>
    );
  }
  const bueno = delta.dir === buenoCuando;
  const Icono = delta.dir === "up" ? ArrowUp : ArrowDown;
  return (
    <span
      className={`mb-0.5 inline-flex h-5 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-semibold ${
        bueno ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      }`}
    >
      <Icono className="size-3" />
      {delta.pct === null ? "nuevo" : `${Math.abs(delta.pct).toFixed(1)}%`}
    </span>
  );
}

type Tono = "good" | "bad" | "primary";
const TONO_CLASE: Record<Tono, string> = {
  good: "bg-success/10 text-success",
  bad: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
};

// Tarjeta grande (Total recaudado / Gastos / Utilidad) -- valor en mono,
// delta como pastilla junto al número, línea del periodo de comparación
// abajo, y un pie completo "Ver detalles" que abre el mismo modal de
// siempre pero con el trato visual de una franja clicable.
function MetricaPrincipal({
  title,
  value,
  icon: Icon,
  tone,
  sub,
  previo,
  delta,
  buenoCuando,
  detalle,
  destacada,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tono;
  sub: string;
  previo?: string;
  delta?: Delta;
  buenoCuando: "up" | "down";
  detalle?: { tipo: string; exportHref: string; rangoQS: string };
  destacada?: boolean;
}) {
  return (
    <Card className={`min-w-0 ${destacada ? "ring-primary/30" : ""}`}>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${TONO_CLASE[tone]}`}>
            <Icon className="size-3.5" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <span className="min-w-0 truncate font-mono text-xl leading-none font-semibold tracking-tight sm:text-2xl lg:text-[28px]">
            {value}
          </span>
          {delta && <DeltaPill delta={delta} buenoCuando={buenoCuando} />}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
        {previo && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{previo}</p>}
      </CardContent>
      {detalle && (
        <DetalleDialog
          tipo={detalle.tipo}
          titulo={title}
          rangoQS={detalle.rangoQS}
          exportHref={detalle.exportHref}
          variant="row"
        />
      )}
    </Card>
  );
}

// Tarjeta chica (Gastos personales / Servicios entregados / Servicios
// nuevos / Clientes nuevos) -- mismo pie clicable, número más chico.
function MetricaSecundaria({
  title,
  value,
  icon: Icon,
  sub,
  delta,
  buenoCuando,
  detalle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
  delta?: Delta;
  buenoCuando: "up" | "down";
  detalle: { tipo: string; exportHref: string; rangoQS: string };
}) {
  return (
    <Card className="min-w-0">
      <CardContent>
        <div className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
          <span className="min-w-0 truncate font-mono text-xl leading-none font-semibold">{value}</span>
          {delta && <DeltaPill delta={delta} buenoCuando={buenoCuando} />}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
      <DetalleDialog
        tipo={detalle.tipo}
        titulo={title}
        rangoQS={detalle.rangoQS}
        exportHref={detalle.exportHref}
        variant="row"
      />
    </Card>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; todo?: string; comparar?: string }>;
}) {
  if (!(await requiereAdmin())) redirect("/admin");

  const { desde, hasta, todo, comparar: compararRaw } = await searchParams;
  const comparar: ModoComparacion | undefined =
    compararRaw === "anterior" || compararRaw === "año" ? compararRaw : undefined;

  if (!desde && !hasta && todo !== "1") {
    const hoyDefault = hoyEnMexico();
    const inicioMesDefault = new Date(
      Date.UTC(hoyDefault.getUTCFullYear(), hoyDefault.getUTCMonth(), 1)
    );
    redirect(
      `/admin/reportes?desde=${isoDate(inicioMesDefault)}&hasta=${isoDate(hoyDefault)}`
    );
  }

  const datos = await obtenerDatosReportes(
    todo === "1" ? undefined : desde,
    todo === "1" ? undefined : hasta,
    comparar
  );
  const {
    desdeEfectivo,
    hastaEfectivo,
    totalRecaudado,
    totalGastos,
    utilidadNeta,
    totalGastosPersonales,
    pagosCount,
    gastosCount,
    gastosPersonalesCount,
    serviciosEntregadosCount,
    serviciosNuevosCount,
    clientesNuevosCount,
    puntosPeriodo,
    granularidadPeriodo,
    statusItems: statusFilas,
    metodoItems: metodoFilas,
    gastosItems: gastosFilas,
    gastosPersonalesItems: gastosPersonalesFilas,
    topClientes,
    pendientePorRecibir,
    pendienteServiciosDetalle,
    comparacion,
  } = datos;

  function deltaDe(actual: number, previo: number | undefined) {
    if (comparacion === undefined || previo === undefined) return undefined;
    return calcularDelta(actual, previo);
  }
  const comparaLabel =
    comparacion?.modo === "año" ? "año pasado" : comparacion ? "periodo anterior" : "";
  const comparaAnioCorto = comparacion ? String(comparacion.desde.getUTCFullYear()) : "";

  const statusItems: ItemBarra[] = statusFilas.map((f) => ({
    label: STATUS_LABEL[f.label as StatusServicio] ?? f.label,
    valor: f.count,
    colorClass: STATUS_COLOR[f.label as StatusServicio] ?? COLOR_OTROS,
  }));
  const metodoItems: ItemBarra[] = metodoFilas.map((f) => ({
    label: f.label,
    valor: f.monto,
    detalle: `${f.count} pago${f.count === 1 ? "" : "s"}`,
    colorClass: f.label === "Otros" ? COLOR_OTROS : (METODO_COLOR[f.label] ?? COLOR_OTROS),
  }));
  const metodoDonutItems: DonutItem[] = metodoFilas.map((f) => ({
    label: f.label,
    value: f.monto,
    color: f.label === "Otros" ? METODO_COLOR_HEX.Otro : (METODO_COLOR_HEX[f.label] ?? METODO_COLOR_HEX.Otro),
  }));
  const gastosItems: ItemBarra[] = gastosFilas.map((f, i) => ({
    label: f.label,
    valor: f.monto,
    detalle: `${f.count} gasto${f.count === 1 ? "" : "s"}`,
    colorClass: f.label === "Otros" ? COLOR_OTROS : CATEGORICOS_GASTO[i % CATEGORICOS_GASTO.length],
  }));
  const gastosPersonalesItems: ItemBarra[] = gastosPersonalesFilas.map((f, i) => ({
    label: f.label,
    valor: f.monto,
    detalle: `${f.count} gasto${f.count === 1 ? "" : "s"}`,
    colorClass: f.label === "Otros" ? COLOR_OTROS : CATEGORICOS_GASTO[i % CATEGORICOS_GASTO.length],
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
    todo === "1"
      ? presets[5]
      : (presets.find((p) => !p.todo && p.desde === desde && p.hasta === hasta) ?? null);

  const exportParams = new URLSearchParams();
  if (todo === "1") {
    exportParams.set("todo", "1");
  } else {
    if (desde) exportParams.set("desde", desde);
    if (hasta) exportParams.set("hasta", hasta);
  }
  if (comparar) exportParams.set("comparar", comparar);
  const exportQuery = exportParams.toString();

  function hrefComparar(modo: ModoComparacion | null) {
    const p = new URLSearchParams();
    if (todo === "1") p.set("todo", "1");
    else {
      if (desde) p.set("desde", desde);
      if (hasta) p.set("hasta", hasta);
    }
    if (modo) p.set("comparar", modo);
    return `/admin/reportes?${p}`;
  }
  const opcionesComparar: { label: string; modo: ModoComparacion | null }[] = [
    { label: "Sin comparar", modo: null },
    { label: "Periodo anterior", modo: "anterior" },
    { label: "Año pasado", modo: "año" },
  ];

  const rangoQS = `desde=${isoDate(desdeEfectivo)}&hasta=${isoDate(hastaEfectivo)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(desdeEfectivo)} — {formatDate(hastaEfectivo)}
            {comparacion && (
              <>
                <span className="text-muted-foreground/60"> · </span>
                comparado con {formatDate(comparacion.desde)} — {formatDate(comparacion.hasta)}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/reportes/pdf?${exportQuery}`}>
              <FileDown />
              Exportar PDF
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/admin/reportes/export?${exportQuery}`}>
              <Download />
              Exportar Excel
            </a>
          </Button>
        </div>
      </div>

      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-16 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground">
              PERIODO
            </span>
            <PillGroup
              items={presets.map((p) => {
                const params = new URLSearchParams();
                if (p.todo) params.set("todo", "1");
                else {
                  if (p.desde) params.set("desde", p.desde);
                  if (p.hasta) params.set("hasta", p.hasta);
                }
                if (comparar) params.set("comparar", comparar);
                return {
                  label: p.label,
                  href: `/admin/reportes?${params}`,
                  activo: presetActivo?.label === p.label,
                };
              })}
            />
          </div>

          <div className="-mx-(--card-spacing) flex flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-(--card-spacing) py-3">
            <span className="w-16 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground">
              COMPARAR
            </span>
            <PillGroup
              items={opcionesComparar.map((o) => ({
                label: o.label,
                href: hrefComparar(o.modo),
                activo: (comparar ?? null) === o.modo,
              }))}
            />
            {comparacion && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitCompare className="size-3.5" />
                Los deltas de cada tarjeta se calculan contra el {comparaLabel}
              </span>
            )}
          </div>

          <form className="grid gap-3 pt-1 sm:grid-cols-[1fr_1fr_auto]">
            {comparar && <input type="hidden" name="comparar" value={comparar} />}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="desde" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5" /> Desde
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
              <Filter />
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricaPrincipal
          title="Total recaudado"
          value={formatCurrency(totalRecaudado)}
          icon={TrendingUp}
          tone="good"
          sub={`${pagosCount} pago${pagosCount === 1 ? "" : "s"} confirmados — neto de comisión de pasarela`}
          previo={
            comparacion
              ? `${comparaAnioCorto}: ${formatCurrency(comparacion.totalRecaudado)} · ${comparacion.pagosCount} pago${comparacion.pagosCount === 1 ? "" : "s"}`
              : undefined
          }
          delta={deltaDe(totalRecaudado, comparacion?.totalRecaudado)}
          buenoCuando="up"
          detalle={{ tipo: "pagos", rangoQS, exportHref: `/admin/pagos/export?confirmado=true&${rangoQS}` }}
        />
        <MetricaPrincipal
          title="Gastos (empresa)"
          value={formatCurrency(totalGastos)}
          icon={TrendingDown}
          tone="bad"
          sub={`${gastosCount} movimiento${gastosCount === 1 ? "" : "s"}`}
          previo={
            comparacion
              ? `${comparaAnioCorto}: ${formatCurrency(comparacion.totalGastos)} · ${comparacion.gastosCount} movimiento${comparacion.gastosCount === 1 ? "" : "s"}`
              : undefined
          }
          delta={deltaDe(totalGastos, comparacion?.totalGastos)}
          buenoCuando="down"
          detalle={{ tipo: "gastos-empresa", rangoQS, exportHref: `/admin/gastos/export?ambito=Empresa&${rangoQS}` }}
        />
        <MetricaPrincipal
          title="Utilidad neta"
          value={formatCurrency(utilidadNeta)}
          icon={Wallet}
          tone="primary"
          sub="Recaudado − gastos (solo empresa)"
          previo={comparacion ? `${comparaAnioCorto}: ${formatCurrency(comparacion.utilidadNeta)}` : undefined}
          delta={deltaDe(utilidadNeta, comparacion?.utilidadNeta)}
          buenoCuando="up"
          destacada
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricaSecundaria
          title="Gastos personales"
          value={formatCurrency(totalGastosPersonales)}
          icon={User}
          sub={`${gastosPersonalesCount} mov. — no resta de la utilidad`}
          delta={deltaDe(totalGastosPersonales, comparacion?.totalGastosPersonales)}
          buenoCuando="down"
          detalle={{ tipo: "gastos-personal", rangoQS, exportHref: `/admin/gastos/export?ambito=Personal&${rangoQS}` }}
        />
        <MetricaSecundaria
          title="Servicios entregados"
          value={String(serviciosEntregadosCount)}
          icon={CheckCircle2}
          sub="Por fecha de fin"
          delta={deltaDe(serviciosEntregadosCount, comparacion?.serviciosEntregadosCount)}
          buenoCuando="up"
          detalle={{ tipo: "servicios-entregados", rangoQS, exportHref: `/admin/servicios/export?status=Entregado&${rangoQS}` }}
        />
        <MetricaSecundaria
          title="Servicios nuevos"
          value={String(serviciosNuevosCount)}
          icon={Briefcase}
          sub="Por fecha de inicio"
          delta={deltaDe(serviciosNuevosCount, comparacion?.serviciosNuevosCount)}
          buenoCuando="up"
          detalle={{ tipo: "servicios-nuevos", rangoQS, exportHref: `/admin/servicios/export?${rangoQS}` }}
        />
        <MetricaSecundaria
          title="Clientes nuevos"
          value={String(clientesNuevosCount)}
          icon={Users}
          sub="Alta en el periodo"
          delta={deltaDe(clientesNuevosCount, comparacion?.clientesNuevosCount)}
          buenoCuando="up"
          detalle={{ tipo: "clientes-nuevos", rangoQS, exportHref: `/admin/clientes/export?${rangoQS}` }}
        />
      </div>

      {pendientePorRecibir.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <CardTitle>Pendiente por recibir</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Servicios aprobados o en proceso que aún no se cobran completos — no incluye
                cotizados, entregados ni cancelados.
              </p>
            </div>
            {pendientePorRecibir.length === 1 && (
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">TOTAL</div>
                <div className="mt-0.5 font-mono text-lg font-semibold">
                  {formatCurrency(pendientePorRecibir[0].total.monto, pendientePorRecibir[0].moneda)}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-4">
            {pendientePorRecibir.map((g) => (
              <div key={g.moneda} className="flex flex-col gap-3">
                {pendientePorRecibir.length > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">{g.moneda}</p>
                    <p className="font-mono text-sm font-semibold">{formatCurrency(g.total.monto, g.moneda)}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Trabajos propios</span>
                      <span className="text-[11px] text-muted-foreground">
                        {g.propios.count} trabajo{g.propios.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-lg font-semibold">
                      {formatCurrency(g.propios.monto, g.moneda)}
                    </p>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${g.total.monto > 0 ? Math.max(2, (g.propios.monto / g.total.monto) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Con intermediario</span>
                      <span className="text-[11px] text-muted-foreground">
                        {g.intermediarios.count} trabajo{g.intermediarios.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-lg font-semibold">
                      {formatCurrency(g.intermediarios.monto, g.moneda)}
                    </p>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
                        style={{
                          width: `${g.total.monto > 0 ? Math.max(2, (g.intermediarios.monto / g.total.monto) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {pendienteServiciosDetalle.length > 0 && (
              <div className="-mx-(--card-spacing) overflow-hidden border-t border-border">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/30 px-(--card-spacing) py-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground sm:grid-cols-[1fr_120px_100px_100px]">
                  <span>SERVICIO</span>
                  <span className="hidden text-right sm:block">STATUS</span>
                  <span className="text-right">COBRADO</span>
                  <span className="text-right">PENDIENTE</span>
                </div>
                {pendienteServiciosDetalle.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/servicios/${s.id}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-border px-(--card-spacing) py-2.5 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_120px_100px_100px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.descripcion}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {s.cliente} · {formatDate(s.fechaInicio)}
                        {s.esIntermediario ? " · intermediario" : ""}
                      </p>
                    </div>
                    <span className="hidden justify-self-end sm:block">
                      <span className={`inline-flex h-5 items-center rounded-md px-2 text-[11px] font-medium ${SERVICIO_STATUS_COLOR[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </span>
                    <span className="text-right font-mono text-sm text-muted-foreground">
                      {formatCurrency(s.cobrado, s.moneda)}
                    </span>
                    <span className="text-right font-mono text-sm font-semibold">
                      {formatCurrency(s.pendiente, s.moneda)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Recaudado vs. gastos</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {granularidadPeriodo === "mes"
              ? "Un punto por mes — así se ve la tendencia de meses anteriores."
              : "Un punto por día."}
            {comparacion && ` Línea punteada: recaudado del ${comparaLabel}.`}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <RecaudadoGastosChart
            datos={puntosPeriodo}
            comparacionRecaudado={comparacion?.recaudadoPorPeriodo}
            comparacionLabel={comparaLabel || undefined}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Servicios por status</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {statusFilas.reduce((acc, f) => acc + f.count, 0)} servicios en el rango
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <DesgloseBarras items={statusItems} formato="numero" vacio="No hay servicios que iniciaran en este rango." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Pagos por método</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {pagosCount} pago{pagosCount === 1 ? "" : "s"} confirmados
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            {metodoItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pagos confirmados en este rango.</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <DonutChart
                  items={metodoDonutItems}
                  centerLabel={formatCurrency(totalRecaudado)}
                  centerSub={`${pagosCount} pago${pagosCount === 1 ? "" : "s"}`}
                />
                <DesgloseBarras items={metodoItems} vacio="No hay pagos confirmados en este rango." />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Gastos por categoría</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Solo gasto de empresa</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-4">
            {gastosItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Receipt className="size-5" />
                </span>
                <p className="text-sm font-medium">Sin gastos de empresa en este rango</p>
                {gastosPersonalesFilas.length > 0 && (
                  <p className="max-w-56 text-xs text-muted-foreground">
                    Los gastos del periodo están marcados como personales, así que no restan de la
                    utilidad neta.
                  </p>
                )}
                <Link
                  href="/admin/gastos"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Registrar un gasto <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <DesgloseBarras items={gastosItems} vacio="No hay gastos de empresa en este rango." />
            )}
          </CardContent>
        </Card>
      </div>

      {(gastosPersonalesItems.length > 0 || totalGastosPersonales > 0) && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <CardTitle>Gastos personales por categoría</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Aparte de los números del negocio — no se suman a Gastos (empresa) ni restan de la
                utilidad neta.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">TOTAL</div>
              <div className="mt-0.5 font-mono text-base font-semibold">{formatCurrency(totalGastosPersonales)}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <DesgloseBarras items={gastosPersonalesItems} vacio="No hay gastos personales en este rango." />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <CardTitle>Clientes con más recaudación</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {topClientes.length} cliente{topClientes.length === 1 ? "" : "s"} pagaron en el rango
            </p>
          </div>
          <Link
            href="/admin/clientes"
            className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Ver todos los clientes <ArrowRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="pt-4">
          {topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pagos confirmados en este rango.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Pagos</TableHead>
                  <TableHead className="text-right">Recaudado</TableHead>
                  <TableHead className="w-40">% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClientes.map((c) => {
                  const pct = totalRecaudado > 0 ? (c.monto / totalRecaudado) * 100 : 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-2.5 hover:underline">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${tonoAvatar(c.id)}`}
                          >
                            {iniciales(c.nombre)}
                          </span>
                          {c.nombre}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{c.count}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold">{formatCurrency(c.monto)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-xs text-muted-foreground">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Los montos se muestran en la moneda de cada pago
        {comparacion && ` · comparación contra el ${comparaLabel}`}
      </p>
    </div>
  );
}
