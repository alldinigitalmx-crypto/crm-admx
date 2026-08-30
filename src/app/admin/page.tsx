import Link from "next/link";
import { redirect } from "next/navigation";
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
  CheckCircle2,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SERVICIO_STATUS_COLOR } from "@/lib/status-colors";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin, permisosModulo } from "@/lib/alcance";
import { obtenerTasasAMXN, resumirMontoMulti, type ResumenMontoMulti } from "@/lib/tipo-cambio";
import { montoNetoEnMXN } from "@/lib/pago-monto";
import { formatCurrency } from "@/lib/format";
import type { Usuario } from "@/generated/prisma/client";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

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
      <CardContent className="flex items-center gap-3 py-2 sm:gap-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10">
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{title}</p>
          <p className="truncate text-lg font-semibold sm:text-xl">{value}</p>
        </div>
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
      <p className="truncate text-xs text-muted-foreground">
        {currencyCorta.format(resumen.montoMXN)}
      </p>
      {resumen.sinConvertir.map((s) => (
        <p key={s.moneda} className="truncate text-xs text-muted-foreground">
          + {formatCurrency(s.monto, s.moneda)}
        </p>
      ))}
    </>
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

// Tarjeta compacta reutilizada por ambos paneles cuando no queda ningún
// pendiente por mostrar en esa vista.
function TodoAlDiaCard({ texto }: { texto: string }) {
  return (
    <Card className="mb-4">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
          <CheckCircle2 className="size-5" />
        </div>
        <div>
          <p className="font-medium">¡Todo al día!</p>
          <p className="text-sm text-muted-foreground">{texto}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SinPendientesCard({ items }: { items: { key: string; title: string }[] }) {
  return (
    <Card className="mt-4">
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          Sin pendientes:
        </span>
        {items.map((p) => (
          <span key={p.key}>{p.title}</span>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const usuario = await currentUsuario();
  if (!usuario) redirect("/login");

  // El panel del dueño (Admin) es un resumen financiero de todo el
  // negocio; el de un usuario interno normal es solo lo que le toca a
  // él — nunca ingresos, embudo de venta ni ventas por origen de la
  // empresa completa.
  if (!esAdmin(usuario)) return <PanelUsuario usuario={usuario} />;
  return <PanelAdmin />;
}

async function PanelAdmin() {
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
    tasas,
  ] = await Promise.all([
    prisma.cliente.count(),
    prisma.servicio.count({ where: { status: { in: ["Aprobado", "EnProceso"] } } }),
    prisma.servicio.count(),
    // No es un aggregate() de Prisma porque hay que restar la comisión de
    // la pasarela y convertir a MXN registro por registro (ver
    // montoNetoEnMXN) -- son pocos pagos al mes, no pesa nada.
    prisma.pago.findMany({
      where: { fecha: { gte: inicioDeMes }, confirmado: true },
      select: { monto: true, moneda: true, montoMXN: true, comision: true, montoIncluyeComision: true },
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
    obtenerTasasAMXN(),
  ]);

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

  const ventasTiendaOnline = ventasPorOrigen.find((v) => v.origen === "TiendaOnline");
  const ventasManual = ventasPorOrigen.find((v) => v.origen === "Manual");

  // En móvil, seis tarjetas repitiendo "no hay nada pendiente" es puro
  // scroll sin información — las vacías se colapsan en una sola tarjeta
  // compacta y solo las que sí tienen algo se ven en detalle.
  const pendientesResumen = [
    { key: "cotizaciones", title: "Cotizaciones por firmar/pagar", count: cotizacionesPendientes.length },
    { key: "pagos", title: "Pagos por confirmar", count: pagosPorConfirmar.length },
    { key: "quejas", title: "Quejas nuevas", count: quejasNuevas.length },
    { key: "tickets", title: "Tickets de acceso", count: ticketsPendientes.length },
    { key: "tareas", title: "Tareas pendientes", count: tareasPendientes.length },
    { key: "ordenes", title: "Órdenes de cambio por aprobar", count: ordenesCambioPendientes.length },
  ];
  const pendientesVacios = pendientesResumen.filter((p) => p.count === 0);
  const hayPendientesActivos = pendientesResumen.some((p) => p.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="text-sm text-muted-foreground">
          Resumen general del negocio
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard title="Clientes" value={String(totalClientes)} icon={Users} />
        <KpiCard
          title="Servicios activos"
          value={String(serviciosActivos)}
          icon={Briefcase}
        />
        <KpiCard
          title="Ingresos del mes"
          value={currencyCorta.format(ingresosMes.reduce((acc, p) => acc + montoNetoEnMXN(p), 0))}
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
                <Badge className={SERVICIO_STATUS_COLOR[s.status] ?? ""}>
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
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Link href="/admin/cotizaciones?status=Enviada">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="py-2">
                <p className="truncate text-xs text-muted-foreground">En negociación</p>
                <p className="truncate text-lg font-semibold sm:text-xl">{resumenEnNegociacion.count}</p>
                <MontoFunnel resumen={resumenEnNegociacion} />
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/cotizaciones?status=Firmada">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="py-2">
                <p className="truncate text-xs text-muted-foreground">Ganadas por formalizar</p>
                <p className="truncate text-lg font-semibold sm:text-xl">{resumenGanadasPorFormalizar.count}</p>
                <MontoFunnel resumen={resumenGanadasPorFormalizar} />
              </CardContent>
            </Card>
          </Link>
          <Card>
            <CardContent className="py-2">
              <p className="truncate text-xs text-muted-foreground">Convertidas a servicio</p>
              <p className="truncate text-lg font-semibold sm:text-xl">{resumenConvertidasAServicio.count}</p>
              <MontoFunnel resumen={resumenConvertidasAServicio} />
            </CardContent>
          </Card>
          <Link href="/admin/cotizaciones?status=Perdida">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="py-2">
                <p className="truncate text-xs text-muted-foreground">Perdidas</p>
                <p className="truncate text-lg font-semibold sm:text-xl">{resumenPerdidas.count}</p>
                <MontoFunnel resumen={resumenPerdidas} />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Ventas por origen</h2>
        <p className="mb-3 text-sm text-muted-foreground">Mes actual</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Link href="/admin/ventas?origen=TiendaOnline">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="flex items-center gap-3 py-2 sm:gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10">
                  <ShoppingBag className="size-4 sm:size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">Tienda Online</p>
                  <p className="truncate text-lg font-semibold sm:text-xl">
                    {currencyCorta.format(Number(ventasTiendaOnline?._sum.total ?? 0))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ventasTiendaOnline?._count ?? 0} venta
                    {(ventasTiendaOnline?._count ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/ventas?origen=Manual">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="flex items-center gap-3 py-2 sm:gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10">
                  <ShoppingBag className="size-4 sm:size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">Manual (otros medios)</p>
                  <p className="truncate text-lg font-semibold sm:text-xl">
                    {currencyCorta.format(Number(ventasManual?._sum.total ?? 0))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
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

        {!hayPendientesActivos && <TodoAlDiaCard texto="No tienes pendientes en ningún módulo." />}

        <div className="grid gap-4 lg:grid-cols-2">
          {cotizacionesPendientes.length > 0 && (
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
                  {nombreClienteCotizacion(c)} — {c.servicio?.descripcion ?? c.descripcion ?? "Negociación"}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.fechaVencimiento ? fecha.format(c.fechaVencimiento) : "sin vencimiento"}
                </span>
              </li>
            ))}
          </PendienteCard>
          )}

          {pagosPorConfirmar.length > 0 && (
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
          )}

          {quejasNuevas.length > 0 && (
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
          )}

          {ticketsPendientes.length > 0 && (
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
          )}

          {tareasPendientes.length > 0 && (
          <PendienteCard
            title="Tareas pendientes"
            icon={ListTodo}
            count={tareasPendientes.length}
            emptyText="No tienes tareas pendientes."
          >
            {tareasPendientes.map((t) => {
              const proyecto =
                t.servicio?.descripcion ?? (t.cotizacion ? nombreClienteCotizacion(t.cotizacion) : null);
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
          )}

          {ordenesCambioPendientes.length > 0 && (
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
          )}
        </div>

        {hayPendientesActivos && pendientesVacios.length > 0 && <SinPendientesCard items={pendientesVacios} />}
      </div>

      <p className="text-xs text-muted-foreground">
        Todos los módulos de Fase 1 están disponibles.
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
async function PanelUsuario({ usuario }: { usuario: Usuario }) {
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
    permisosCotizaciones.puedeVer
      ? prisma.cotizacion.findMany({
          where: { status: "Enviada", ...cotizacionPropiaWhere },
          orderBy: { fechaVencimiento: "asc" },
          take: 10,
          include: { cliente: true, servicio: true },
        })
      : Promise.resolve([]),
    permisosPagos.puedeVer
      ? prisma.pago.findMany({
          where: {
            confirmado: false,
            ...(permisosPagos.verTodo ? {} : { servicio: { responsableId: usuario.id } }),
          },
          orderBy: { fecha: "asc" },
          take: 10,
          include: { servicio: { include: { cliente: true } } },
        })
      : Promise.resolve([]),
    permisosQuejas.puedeVer
      ? prisma.queja.findMany({
          where: { status: "Nueva", ...quejaPropiaWhere },
          orderBy: { creadoEn: "asc" },
          take: 10,
          include: { cliente: true },
        })
      : Promise.resolve([]),
    permisosTareas.puedeVer
      ? prisma.tarea.findMany({
          where: { completada: false, ...(permisosTareas.verTodo ? {} : { asignadoAId: usuario.id }) },
          orderBy: [{ fechaLimite: "asc" }, { creadoEn: "desc" }],
          take: 10,
          include: { servicio: true, cotizacion: { include: { cliente: true } } },
        })
      : Promise.resolve([]),
    permisosServicios.puedeVer
      ? prisma.ordenCambio.findMany({
          where: {
            status: "Pendiente",
            ...(permisosServicios.verTodo ? {} : { servicio: { responsableId: usuario.id } }),
          },
          orderBy: { creadoEn: "asc" },
          take: 10,
          include: { servicio: { include: { cliente: true } } },
        })
      : Promise.resolve([]),
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

  const pendientesResumen: { key: string; title: string; count: number }[] = [];
  if (permisosCotizaciones.puedeVer)
    pendientesResumen.push({
      key: "cotizaciones",
      title: "Cotizaciones por firmar/pagar",
      count: cotizacionesPendientes.length,
    });
  if (permisosPagos.puedeVer)
    pendientesResumen.push({ key: "pagos", title: "Pagos por confirmar", count: pagosPorConfirmar.length });
  if (permisosQuejas.puedeVer)
    pendientesResumen.push({ key: "quejas", title: "Quejas nuevas", count: quejasNuevas.length });
  if (permisosTareas.puedeVer)
    pendientesResumen.push({ key: "tareas", title: "Tareas pendientes", count: tareasPendientes.length });
  if (permisosServicios.puedeVer)
    pendientesResumen.push({
      key: "ordenes",
      title: "Órdenes de cambio por aprobar",
      count: ordenesCambioPendientes.length,
    });

  const pendientesVacios = pendientesResumen.filter((p) => p.count === 0);
  const hayPendientesActivos = pendientesResumen.some((p) => p.count > 0);
  const tieneAlgunModulo = pendientesResumen.length > 0;

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

      {tieneAlgunModulo && (
        <div>
          <h2 className="text-lg font-semibold">Mis pendientes</h2>
          <p className="mb-3 text-sm text-muted-foreground">Cosas que requieren tu atención</p>

          {!hayPendientesActivos && <TodoAlDiaCard texto="No tienes pendientes en lo que te toca." />}

          <div className="grid gap-4 lg:grid-cols-2">
            {permisosCotizaciones.puedeVer && cotizacionesPendientes.length > 0 && (
              <PendienteCard
                title="Cotizaciones por firmar/pagar"
                icon={FileText}
                count={cotizacionesPendientes.length}
                emptyText="No hay cotizaciones pendientes."
              >
                {cotizacionesPendientes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/cotizaciones/${c.id}`} className="truncate hover:underline">
                      {nombreClienteCotizacion(c)} — {c.servicio?.descripcion ?? c.descripcion ?? "Negociación"}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.fechaVencimiento ? fecha.format(c.fechaVencimiento) : "sin vencimiento"}
                    </span>
                  </li>
                ))}
              </PendienteCard>
            )}

            {permisosPagos.puedeVer && pagosPorConfirmar.length > 0 && (
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
            )}

            {permisosQuejas.puedeVer && quejasNuevas.length > 0 && (
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
                    <span className="shrink-0 text-xs text-muted-foreground">{fecha.format(q.creadoEn)}</span>
                  </li>
                ))}
              </PendienteCard>
            )}

            {permisosTareas.puedeVer && tareasPendientes.length > 0 && (
              <PendienteCard
                title="Tareas pendientes"
                icon={ListTodo}
                count={tareasPendientes.length}
                emptyText="No tienes tareas pendientes."
              >
                {tareasPendientes.map((t) => {
                  const proyecto =
                    t.servicio?.descripcion ?? (t.cotizacion ? nombreClienteCotizacion(t.cotizacion) : null);
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
            )}

            {permisosServicios.puedeVer && ordenesCambioPendientes.length > 0 && (
              <PendienteCard
                title="Órdenes de cambio por aprobar"
                icon={Briefcase}
                count={ordenesCambioPendientes.length}
                emptyText="No hay órdenes de cambio pendientes."
              >
                {ordenesCambioPendientes.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/servicios/${o.servicio.id}`} className="truncate hover:underline">
                      {o.servicio.cliente.nombre} — {o.descripcion}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {currency.format(Number(o.monto))}
                    </span>
                  </li>
                ))}
              </PendienteCard>
            )}
          </div>

          {hayPendientesActivos && pendientesVacios.length > 0 && <SinPendientesCard items={pendientesVacios} />}
        </div>
      )}

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
