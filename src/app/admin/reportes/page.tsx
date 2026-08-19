import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Briefcase,
  CheckCircle2,
  Users,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  construirRangoFecha,
  rangoEfectivo,
  agruparRecaudadoGastos,
  topNConOtros,
} from "@/lib/reportes";
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
import type { Prisma, StatusServicio, MetodoPago } from "@/generated/prisma/client";

const STATUS_ORDEN: StatusServicio[] = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"];
const STATUS_COLOR: Record<StatusServicio, string> = {
  Cotizado: "bg-slate-400 dark:bg-slate-500",
  Aprobado: "bg-blue-600 dark:bg-blue-400",
  EnProceso: "bg-amber-500 dark:bg-amber-400",
  Entregado: "bg-emerald-600 dark:bg-emerald-400",
  Cancelado: "bg-red-500 dark:bg-red-400",
};

const METODO_LABEL: Record<string, string> = {
  Efectivo: "Efectivo",
  Transferencia: "Transferencia",
  MercadoPago: "Mercado Pago",
  PayPal: "PayPal",
  Tarjeta: "Tarjeta",
  WesternUnion: "Western Union",
  Binance: "Binance",
  Deposito: "Depósito",
  Otro: "Otro",
};
const METODO_COLOR: Record<string, string> = {
  Efectivo: "bg-emerald-600 dark:bg-emerald-400",
  Transferencia: "bg-blue-600 dark:bg-blue-400",
  MercadoPago: "bg-sky-500 dark:bg-sky-400",
  PayPal: "bg-violet-500 dark:bg-violet-400",
  Tarjeta: "bg-pink-500 dark:bg-pink-400",
  WesternUnion: "bg-amber-500 dark:bg-amber-400",
  Binance: "bg-orange-500 dark:bg-orange-400",
  Deposito: "bg-teal-500 dark:bg-teal-400",
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
      ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "bg-red-600/10 text-red-600 dark:text-red-400"
        : "bg-blue-600/10 text-blue-600 dark:text-blue-400";
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
        servicio: { select: { cliente: { select: { id: true, nombre: true } } } },
      },
      orderBy: { fecha: "asc" },
    }),
    prisma.gasto.findMany({
      where: gastosWhere,
      select: { fecha: true, monto: true, categoria: true },
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
  const statusItems: ItemBarra[] = STATUS_ORDEN.map((s) => ({
    label: s,
    valor: statusCounts[s],
    colorClass: STATUS_COLOR[s],
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
  const metodoItems: ItemBarra[] = metodoTop.map(([metodo, v]) => ({
    label: METODO_LABEL[metodo] ?? metodo,
    valor: v.monto,
    detalle: `${v.count} pago${v.count === 1 ? "" : "s"}`,
    colorClass: METODO_COLOR[metodo as MetodoPago] ?? COLOR_OTROS,
  }));
  if (metodoResto.length > 0) {
    const monto = metodoResto.reduce((acc, [, v]) => acc + v.monto, 0);
    const count = metodoResto.reduce((acc, [, v]) => acc + v.count, 0);
    metodoItems.push({ label: "Otros", valor: monto, detalle: `${count} pagos`, colorClass: COLOR_OTROS });
  }

  const gastosPorCategoria = new Map<string, { monto: number; count: number }>();
  for (const g of gastos) {
    const cur = gastosPorCategoria.get(g.categoria) ?? { monto: 0, count: 0 };
    cur.monto += Number(g.monto);
    cur.count += 1;
    gastosPorCategoria.set(g.categoria, cur);
  }
  const gastosTop = topNConOtros(
    Array.from(gastosPorCategoria.entries()).map(([label, v]) => ({ label, monto: v.monto, count: v.count })),
    5
  );
  const gastosItems: ItemBarra[] = gastosTop.map((item, i) => ({
    label: item.label,
    valor: item.monto,
    detalle: `${item.count} gasto${item.count === 1 ? "" : "s"}`,
    colorClass: item.label === "Otros" ? COLOR_OTROS : CATEGORICOS_GASTO[i % CATEGORICOS_GASTO.length],
  }));

  const porCliente = new Map<number, { nombre: string; monto: number; count: number }>();
  for (const p of pagos) {
    const c = p.servicio.cliente;
    const cur = porCliente.get(c.id) ?? { nombre: c.nombre, monto: 0, count: 0 };
    cur.monto += Number(p.monto);
    cur.count += 1;
    porCliente.set(c.id, cur);
  }
  const topClientes = Array.from(porCliente.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(desdeEfectivo)} — {formatDate(hastaEfectivo)}
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
        <KpiCard title="Total recaudado" value={formatCurrency(totalRecaudado)} icon={TrendingUp} tone="good" sub={`${pagos.length} pagos confirmados`} />
        <KpiCard title="Gastos (empresa)" value={formatCurrency(totalGastos)} icon={TrendingDown} tone="bad" sub={`${gastos.length} movimientos`} />
        <KpiCard
          title="Utilidad neta"
          value={formatCurrency(utilidadNeta)}
          icon={Wallet}
          tone={utilidadNeta >= 0 ? "good" : "bad"}
          sub="Recaudado − gastos"
        />
        <KpiCard title="Servicios entregados" value={String(serviciosEntregadosCount)} icon={CheckCircle2} sub="Por fecha de fin" />
        <KpiCard title="Servicios nuevos" value={String(serviciosNuevos.length)} icon={Briefcase} sub="Por fecha de inicio" />
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
            <DesgloseBarras items={metodoItems} vacio="No hay pagos confirmados en este rango." />
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/clientes/${c.id}`} className="hover:underline">
                        {c.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{c.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
