import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Briefcase,
  CheckCircle2,
  Users,
  Download,
  FileDown,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/format";
import { obtenerDatosReportes } from "@/lib/reportes-data";
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
import type { StatusServicio } from "@/generated/prisma/client";

// Colores planos (no clases bg-*) para los segmentos de la dona — el mismo
// tono conceptual que METODO_COLOR de abajo, pero utilizable como stroke SVG.
const METODO_COLOR_HEX: Record<string, string> = {
  Efectivo: "#10b981",
  Transferencia: "#6366f1",
  "Mercado Pago": "#0ea5e9",
  PayPal: "#8b5cf6",
  Tarjeta: "#ec4899",
  "Western Union": "#f59e0b",
  Binance: "#f97316",
  Depósito: "#14b8a6",
  Otro: "#a1a1aa",
};

const STATUS_COLOR: Record<StatusServicio, string> = {
  Cotizado: "bg-slate-400 dark:bg-slate-500",
  Aprobado: "bg-blue-600 dark:bg-blue-400",
  EnProceso: "bg-amber-500 dark:bg-amber-400",
  Entregado: "bg-emerald-600 dark:bg-emerald-400",
  Cancelado: "bg-red-500 dark:bg-red-400",
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

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "default",
  sub,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "good" | "bad";
  sub?: string;
}) {
  const toneClass =
    tone === "good"
      ? "bg-success/10 text-success"
      : tone === "bad"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-2">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const datos = await obtenerDatosReportes(desde, hasta);
  const {
    desdeEfectivo,
    hastaEfectivo,
    totalRecaudado,
    totalGastos,
    utilidadNeta,
    pagosCount,
    gastosCount,
    serviciosEntregadosCount,
    serviciosNuevosCount,
    clientesNuevosCount,
    puntosPeriodo,
    statusItems: statusFilas,
    metodoItems: metodoFilas,
    gastosItems: gastosFilas,
    topClientes,
  } = datos;

  const statusItems: ItemBarra[] = statusFilas.map((f) => ({
    label: f.label,
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

  const hoy = new Date();
  const hoyIso = isoDate(hoy);
  const hace7 = new Date(hoy);
  hace7.setUTCDate(hace7.getUTCDate() - 6);
  const hace30 = new Date(hoy);
  hace30.setUTCDate(hace30.getUTCDate() - 29);
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const inicioAno = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));

  const presets = [
    { label: "Hoy", desde: hoyIso, hasta: hoyIso },
    { label: "7 días", desde: isoDate(hace7), hasta: hoyIso },
    { label: "30 días", desde: isoDate(hace30), hasta: hoyIso },
    { label: "Este mes", desde: isoDate(inicioMes), hasta: hoyIso },
    { label: "Este año", desde: isoDate(inicioAno), hasta: hoyIso },
    { label: "Todo", desde: undefined, hasta: undefined },
  ];
  const presetActivo = presets.find((p) => p.desde === desde && p.hasta === hasta) ?? (!desde && !hasta ? presets[5] : null);

  const exportParams = new URLSearchParams();
  if (desde) exportParams.set("desde", desde);
  if (hasta) exportParams.set("hasta", hasta);
  const exportQuery = exportParams.toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(desdeEfectivo)} — {formatDate(hastaEfectivo)}
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
            <a href={`/admin/reportes/export/ingresos?${exportQuery}`}>
              <Download />
              Ingresos (Excel)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/admin/reportes/export/gastos?${exportQuery}`}>
              <Download />
              Gastos (Excel)
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Rango de fechas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const params = new URLSearchParams();
              if (p.desde) params.set("desde", p.desde);
              if (p.hasta) params.set("hasta", p.hasta);
              const href = params.toString() ? `/admin/reportes?${params}` : "/admin/reportes";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Total recaudado" value={formatCurrency(totalRecaudado)} icon={TrendingUp} tone="good" sub={`${pagosCount} pagos confirmados`} />
        <KpiCard title="Gastos (empresa)" value={formatCurrency(totalGastos)} icon={TrendingDown} tone="bad" sub={`${gastosCount} movimientos`} />
        <KpiCard
          title="Utilidad neta"
          value={formatCurrency(utilidadNeta)}
          icon={Wallet}
          tone={utilidadNeta >= 0 ? "good" : "bad"}
          sub="Recaudado − gastos"
        />
        <KpiCard title="Servicios entregados" value={String(serviciosEntregadosCount)} icon={CheckCircle2} sub="Por fecha de fin" />
        <KpiCard title="Servicios nuevos" value={String(serviciosNuevosCount)} icon={Briefcase} sub="Por fecha de inicio" />
        <KpiCard title="Clientes nuevos" value={String(clientesNuevosCount)} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recaudado vs. gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <RecaudadoGastosChart datos={puntosPeriodo} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Servicios por status</CardTitle>
          </CardHeader>
          <CardContent>
            <DesgloseBarras items={statusItems} formato="numero" vacio="No hay servicios que iniciaran en este rango." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pagos por método</CardTitle>
          </CardHeader>
          <CardContent>
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
          <CardHeader>
            <CardTitle className="text-sm font-medium">Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <DesgloseBarras items={gastosItems} vacio="No hay gastos de empresa en este rango." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Clientes con más recaudación</CardTitle>
        </CardHeader>
        <CardContent>
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
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {c.nombre.trim().charAt(0).toUpperCase() || "?"}
                          </span>
                          {c.nombre}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.monto)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </span>
                          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
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
    </div>
  );
}
