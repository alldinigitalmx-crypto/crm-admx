import Link from "next/link";
import {
  Users,
  Briefcase,
  CreditCard,
  LayoutDashboard,
  FileText,
  Landmark,
  LifeBuoy,
  KeyRound,
  ListTodo,
  ShoppingBag,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const fecha = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function KpiCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PendienteCard({
  title,
  icon: Icon,
  count,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {count > 0 && <Badge variant="secondary">{count}</Badge>}
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-2">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const inicioDeMes = new Date();
  inicioDeMes.setDate(1);
  inicioDeMes.setHours(0, 0, 0, 0);

  const [
    totalClientes,
    serviciosActivos,
    totalServicios,
    ingresosMes,
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
  ] = await Promise.all([
    prisma.cliente.count(),
    prisma.servicio.count({ where: { status: { in: ["Aprobado", "EnProceso"] } } }),
    prisma.servicio.count(),
    prisma.pago.aggregate({
      _sum: { monto: true },
      where: { fecha: { gte: inicioDeMes }, confirmado: true },
    }),
    prisma.servicio.groupBy({ by: ["status"], _count: true }),
    prisma.cotizacion.findMany({
      where: { status: "Enviada" },
      orderBy: { fechaVencimiento: "asc" },
      take: 10,
      include: { cliente: true, servicio: true },
    }),
    prisma.pago.findMany({
      where: { confirmado: false },
      orderBy: { fecha: "asc" },
      take: 10,
      include: { servicio: { include: { cliente: true } } },
    }),
    prisma.queja.findMany({
      where: { status: "Nueva" },
      orderBy: { creadoEn: "asc" },
      take: 10,
      include: { cliente: true },
    }),
    prisma.ticketAcceso.findMany({
      where: { status: "Pendiente" },
      orderBy: { fechaSolicitud: "asc" },
      take: 10,
      include: { usuarioSolicitante: true },
    }),
    prisma.ordenCambio.findMany({
      where: { status: "Pendiente" },
      orderBy: { creadoEn: "asc" },
      take: 10,
      include: { servicio: { include: { cliente: true } } },
    }),
    prisma.tarea.findMany({
      where: { completada: false },
      orderBy: [{ fechaLimite: "asc" }, { creadoEn: "asc" }],
      take: 10,
      include: { servicio: true, cotizacion: { include: { cliente: true } } },
    }),
    prisma.cotizacion.aggregate({
      _count: true,
      _sum: { montoTotal: true },
      where: { status: "Enviada", servicioId: null },
    }),
    prisma.cotizacion.aggregate({
      _count: true,
      _sum: { montoTotal: true },
      where: { status: "Firmada", servicioId: null },
    }),
    prisma.cotizacion.aggregate({
      _count: true,
      _sum: { montoTotal: true },
      where: { servicioId: { not: null } },
    }),
    prisma.cotizacion.aggregate({
      _count: true,
      _sum: { montoTotal: true },
      where: { status: "Perdida" },
    }),
    prisma.venta.groupBy({
      by: ["origen"],
      _sum: { total: true },
      _count: true,
      where: { fecha: { gte: inicioDeMes } },
    }),
  ]);

  const ventasTiendaOnline = ventasPorOrigen.find((v) => v.origen === "TiendaOnline");
  const ventasManual = ventasPorOrigen.find((v) => v.origen === "Manual");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="text-sm text-muted-foreground">
          Resumen general del negocio
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Clientes" value={String(totalClientes)} icon={Users} />
        <KpiCard
          title="Servicios activos"
          value={String(serviciosActivos)}
          icon={Briefcase}
        />
        <KpiCard
          title="Ingresos del mes"
          value={currency.format(Number(ingresosMes._sum.monto ?? 0))}
          icon={CreditCard}
        />
        <KpiCard
          title="Servicios totales"
          value={String(totalServicios)}
          icon={LayoutDashboard}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Servicios por status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {serviciosPorStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay servicios registrados.
            </p>
          ) : (
            serviciosPorStatus.map((s) => (
              <Link key={s.status} href={`/admin/servicios?status=${s.status}`}>
                <Badge variant="outline">
                  {s.status}: {s._count}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Embudo de venta</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          De la negociación al servicio confirmado
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/cotizaciones?status=Enviada">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="py-2">
                <p className="text-xs text-muted-foreground">En negociación</p>
                <p className="text-xl font-semibold">{enNegociacion._count}</p>
                <p className="text-xs text-muted-foreground">
                  {currency.format(Number(enNegociacion._sum.montoTotal ?? 0))}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/cotizaciones?status=Firmada">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="py-2">
                <p className="text-xs text-muted-foreground">Ganadas por formalizar</p>
                <p className="text-xl font-semibold">{ganadasPorFormalizar._count}</p>
                <p className="text-xs text-muted-foreground">
                  {currency.format(Number(ganadasPorFormalizar._sum.montoTotal ?? 0))}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Card>
            <CardContent className="py-2">
              <p className="text-xs text-muted-foreground">Convertidas a servicio</p>
              <p className="text-xl font-semibold">{convertidasAServicio._count}</p>
              <p className="text-xs text-muted-foreground">
                {currency.format(Number(convertidasAServicio._sum.montoTotal ?? 0))}
              </p>
            </CardContent>
          </Card>
          <Link href="/admin/cotizaciones?status=Perdida">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="py-2">
                <p className="text-xs text-muted-foreground">Perdidas</p>
                <p className="text-xl font-semibold">{perdidas._count}</p>
                <p className="text-xs text-muted-foreground">
                  {currency.format(Number(perdidas._sum.montoTotal ?? 0))}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Ventas por origen</h2>
        <p className="mb-3 text-sm text-muted-foreground">Mes actual</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/ventas?origen=TiendaOnline">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="flex items-center gap-4 py-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tienda Online</p>
                  <p className="text-xl font-semibold">
                    {currency.format(Number(ventasTiendaOnline?._sum.total ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ventasTiendaOnline?._count ?? 0} venta
                    {(ventasTiendaOnline?._count ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/ventas?origen=Manual">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="flex items-center gap-4 py-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Manual (otros medios)</p>
                  <p className="text-xl font-semibold">
                    {currency.format(Number(ventasManual?._sum.total ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ventasManual?._count ?? 0} venta
                    {(ventasManual?._count ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Mis pendientes</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Cosas que requieren tu atención
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <PendienteCard
            title="Cotizaciones por firmar/pagar"
            icon={FileText}
            count={cotizacionesPendientes.length}
            emptyText="No hay cotizaciones pendientes."
          >
            {cotizacionesPendientes.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/admin/cotizaciones/${c.id}`}
                  className="truncate hover:underline"
                >
                  {c.cliente.nombre} — {c.servicio?.descripcion ?? c.descripcion ?? "Negociación"}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.fechaVencimiento ? fecha.format(c.fechaVencimiento) : "sin vencimiento"}
                </span>
              </li>
            ))}
          </PendienteCard>

          <PendienteCard
            title="Pagos por confirmar"
            icon={Landmark}
            count={pagosPorConfirmar.length}
            emptyText="No hay pagos pendientes de confirmar."
          >
            {pagosPorConfirmar.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <Link
                  href={
                    p.cotizacionId
                      ? `/admin/cotizaciones/${p.cotizacionId}`
                      : `/admin/servicios/${p.servicio.id}`
                  }
                  className="truncate hover:underline"
                >
                  {p.servicio.cliente.nombre} — {p.servicio.descripcion}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {currency.format(Number(p.monto))}
                </span>
              </li>
            ))}
          </PendienteCard>

          <PendienteCard
            title="Quejas nuevas"
            icon={LifeBuoy}
            count={quejasNuevas.length}
            emptyText="No hay quejas nuevas."
          >
            {quejasNuevas.map((q) => (
              <li key={q.id} className="flex items-center justify-between text-sm">
                <Link href="/admin/quejas" className="truncate hover:underline">
                  {q.cliente.nombre} — {q.categoria}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fecha.format(q.creadoEn)}
                </span>
              </li>
            ))}
          </PendienteCard>

          <PendienteCard
            title="Tickets de acceso"
            icon={KeyRound}
            count={ticketsPendientes.length}
            emptyText="No hay tickets de acceso pendientes."
          >
            {ticketsPendientes.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <Link href="/admin/usuarios" className="truncate hover:underline">
                  {t.usuarioSolicitante.nombre} — {t.moduloSolicitado}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fecha.format(t.fechaSolicitud)}
                </span>
              </li>
            ))}
          </PendienteCard>

          <PendienteCard
            title="Tareas pendientes"
            icon={ListTodo}
            count={tareasPendientes.length}
            emptyText="No tienes tareas pendientes."
          >
            {tareasPendientes.map((t) => {
              const proyecto = t.servicio?.descripcion ?? t.cotizacion?.cliente.nombre ?? null;
              const vencida = t.fechaLimite && t.fechaLimite < new Date();
              const href = t.servicioId
                ? `/admin/servicios/${t.servicioId}`
                : t.cotizacionId
                  ? `/admin/cotizaciones/${t.cotizacionId}`
                  : "/admin/tareas";
              return (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <Link href={href} className="truncate hover:underline">
                    {t.titulo}
                    {proyecto ? ` — ${proyecto}` : ""}
                  </Link>
                  <span
                    className={`shrink-0 text-xs ${vencida ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {t.fechaLimite ? fecha.format(t.fechaLimite) : t.prioridad}
                  </span>
                </li>
              );
            })}
          </PendienteCard>

          <PendienteCard
            title="Órdenes de cambio por aprobar"
            icon={Briefcase}
            count={ordenesCambioPendientes.length}
            emptyText="No hay órdenes de cambio pendientes."
          >
            {ordenesCambioPendientes.map((o) => (
              <li key={o.id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/admin/servicios/${o.servicio.id}`}
                  className="truncate hover:underline"
                >
                  {o.servicio.cliente.nombre} — {o.descripcion}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {currency.format(Number(o.monto))}
                </span>
              </li>
            ))}
          </PendienteCard>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Todos los módulos de Fase 1 están disponibles.
      </p>
    </div>
  );
}
