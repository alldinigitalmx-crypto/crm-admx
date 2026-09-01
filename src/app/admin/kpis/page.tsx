import { redirect } from "next/navigation";
import { Ticket, Percent, Clock, Repeat } from "lucide-react";

import { requiereAdmin } from "@/lib/alcance";
import { prisma } from "@/lib/prisma";
import { hoyEnMexico } from "@/lib/fecha";
import { construirRangoFecha } from "@/lib/reportes";
import { obtenerTasasAMXN } from "@/lib/tipo-cambio";
import { montoTotalServicio } from "@/lib/servicio";
import {
  calcularTicketPromedio,
  calcularTasaConversion,
  calcularTiempoCierrePromedio,
  calcularClientesRecurrentes,
} from "@/lib/kpis";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Prisma } from "@/generated/prisma/client";

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
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
}

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; todo?: string }>;
}) {
  if (!(await requiereAdmin())) redirect("/admin");

  const { desde, hasta, todo } = await searchParams;

  // Mismo default que Reportes: sin filtro en la URL, "Este mes" de
  // entrada -- es el caso que de verdad se consulta a diario.
  if (!desde && !hasta && todo !== "1") {
    const hoyDefault = hoyEnMexico();
    const inicioMesDefault = new Date(Date.UTC(hoyDefault.getUTCFullYear(), hoyDefault.getUTCMonth(), 1));
    redirect(`/admin/kpis?desde=${isoDate(inicioMesDefault)}&hasta=${isoDate(hoyDefault)}`);
  }

  const rango = construirRangoFecha(todo === "1" ? undefined : desde, todo === "1" ? undefined : hasta);

  const whereServiciosNuevos: Prisma.ServicioWhereInput = rango ? { fechaInicio: rango } : {};
  const whereCotizacionesEmitidas: Prisma.CotizacionWhereInput = rango ? { fechaEmision: rango } : {};
  const whereCotizacionesCerradas: Prisma.CotizacionWhereInput = rango
    ? { fechaFirma: { ...rango, not: null } }
    : { fechaFirma: { not: null } };

  const [serviciosNuevos, cotizacionesEmitidas, cotizacionesCerradas, clientes, tasas] = await Promise.all([
    prisma.servicio.findMany({
      where: whereServiciosNuevos,
      select: { montoInicial: true, moneda: true, ordenesCambio: { select: { status: true, monto: true } } },
    }),
    prisma.cotizacion.findMany({ where: whereCotizacionesEmitidas, select: { status: true } }),
    prisma.cotizacion.findMany({
      where: whereCotizacionesCerradas,
      select: { fechaEmision: true, fechaFirma: true },
    }),
    // Clientes recurrentes es histórico a propósito (no depende del
    // rango) -- mismo criterio que "Pendiente por recibir" en Reportes.
    prisma.cliente.findMany({ select: { _count: { select: { servicios: true } } } }),
    obtenerTasasAMXN(),
  ]);

  const montosMXN = serviciosNuevos.map((s) => {
    const moneda = s.moneda ?? "MXN";
    const total = montoTotalServicio(s);
    if (moneda === "MXN") return total;
    const tasa = tasas[moneda as "USD" | "EUR"];
    return tasa ? total * tasa : null;
  });

  const ticket = calcularTicketPromedio(montosMXN);
  const conversion = calcularTasaConversion(cotizacionesEmitidas.map((c) => c.status));
  const cierre = calcularTiempoCierrePromedio(cotizacionesCerradas);
  const recurrentes = calcularClientesRecurrentes(clientes.map((c) => c._count.servicios));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">KPIs</h1>
        <p className="text-sm text-muted-foreground">
          Métricas que no salen en Reportes ni en el Panel -- un ángulo distinto del negocio.
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <form className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desde" className="text-xs text-muted-foreground">
                Desde
              </Label>
              <Input id="desde" type="date" name="desde" defaultValue={desde ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hasta" className="text-xs text-muted-foreground">
                Hasta
              </Label>
              <Input id="hasta" type="date" name="hasta" defaultValue={hasta ?? ""} />
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <a href="/admin/kpis?todo=1">Todo</a>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          title="Clientes recurrentes"
          value={`${recurrentes.pct.toFixed(0)}%`}
          sub={`${recurrentes.recurrentes} de ${recurrentes.total} clientes — histórico, no depende del rango`}
          icon={Repeat}
        />
      </div>
    </div>
  );
}
