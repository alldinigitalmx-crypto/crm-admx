import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Pencil, Mail, MessageCircle, CalendarDays, Plus, ShieldAlert } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio } from "@/lib/servicio";
import { montoEnMXN } from "@/lib/pago-monto";
import { totalServicioMXN, pendienteServicioMXN } from "@/lib/cliente-metricas";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { PortalAccessCard } from "@/components/clientes/portal-access-card";
import { DeleteClienteButton } from "@/components/clientes/delete-cliente-button";
import { ServicioFormDialog } from "@/components/servicios/servicio-form-dialog";
import { QuejaFormDialog } from "@/components/quejas/queja-form-dialog";
import { QuejaDetalleDialog } from "@/components/quejas/queja-detalle-dialog";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaLista } from "@/components/tareas/tarea-lista";
import {
  desactivarPortalCliente,
  eliminarCliente,
  guardarPasswordPortalCliente,
  updateCliente,
} from "@/app/admin/clientes/actions";
import { actualizarQueja, crearQueja } from "@/app/admin/quejas/actions";
import { crearTarea } from "@/app/admin/tareas/actions";
import { createServicio } from "@/app/admin/servicios/actions";
import {
  SERVICIO_STATUS_COLOR,
  SERVICIO_STATUS_BAR,
  COTIZACION_STATUS_COLOR,
  QUEJA_STATUS_COLOR,
  CLIENTE_ETIQUETA_COLOR,
  CONFIRMADO_COLOR,
  PENDIENTE_COLOR,
} from "@/lib/status-colors";
import { mailtoHref, whatsappHref, mensajeAgendarCita } from "@/lib/contacto";

const AVATAR_DEFAULT = "bg-primary/10 text-primary";
const TABS = ["resumen", "servicios", "cotizaciones", "pagos", "quejas", "notas"] as const;
type TabValue = (typeof TABS)[number];

type Evento = { fecha: Date; texto: string; detalle: string; color: string };

export default async function ClienteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const clienteId = Number(id);
  const activeTab: TabValue = TABS.includes(tab as TabValue) ? (tab as TabValue) : "resumen";

  const cliente = clienteId
    ? await prisma.cliente.findUnique({
        where: { id: clienteId },
        include: {
          servicios: {
            orderBy: { creadoEn: "desc" },
            include: {
              ordenesCambio: true,
              pagos: { include: { confirmadoPor: { select: { nombre: true } } } },
              cotizaciones: true,
              intermediario: true,
              responsable: { select: { nombre: true } },
            },
          },
          quejas: { orderBy: { creadoEn: "desc" }, include: { servicio: true } },
          tareas: {
            where: { completada: false },
            orderBy: [{ fechaLimite: "asc" }, { creadoEn: "desc" }],
          },
        },
      })
    : null;

  if (!cliente) notFound();

  const usuarioActual = await currentUsuario();
  const permisos = await permisosModulo(usuarioActual, "Clientes");
  if (!permisos.puedeVer) redirect("/admin");

  const esPropio =
    permisos.verTodo ||
    cliente.servicios.some((s) => s.responsableId === usuarioActual?.id);

  if (!esPropio) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{cliente.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            No tienes servicios asignados de este cliente — solo puedes ver su nombre.
          </p>
        </div>
      </div>
    );
  }

  const [usuarios, intermediarios] = await Promise.all([
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.intermediario.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const clienteFijoOpcion = {
    id: cliente.id,
    nombre: cliente.nombre,
    servicios: cliente.servicios.map((s) => ({ id: s.id, descripcion: s.descripcion })),
  };

  const totalServicios = cliente.servicios.length;
  const serviciosActivos = cliente.servicios.filter((s) =>
    ["Aprobado", "EnProceso"].includes(s.status)
  );
  // Un cliente puede tener servicios cotizados en monedas distintas (MXN,
  // USD, COP...) -- se normalizan a MXN con Servicio.montoInicialMXN /
  // Pago.montoMXN antes de sumar (misma lógica que los KPIs globales de la
  // lista, ver src/lib/cliente-metricas.ts), o sumar los montos crudos
  // mezclaría pesos colombianos con pesos mexicanos como si fueran la
  // misma moneda.
  const montoTotalFacturado = cliente.servicios.reduce(
    (acc, s) => acc + totalServicioMXN(s),
    0
  );

  const pagos = cliente.servicios.flatMap((s) =>
    s.pagos.map((p) => ({ ...p, servicioDescripcion: s.descripcion }))
  );
  // Este sí se puede convertir bien: cada Pago ya trae su equivalente en
  // MXN (montoMXN) cuando no fue pagado en pesos.
  const montoTotalPagado = pagos
    .filter((p) => p.confirmado)
    .reduce((acc, p) => acc + montoEnMXN(p), 0);
  const montoTotalSaldo = cliente.servicios.reduce(
    (acc, s) => acc + pendienteServicioMXN(s, s.pagos),
    0
  );
  const serviciosConSaldo = cliente.servicios.filter(
    (s) => pendienteServicioMXN(s, s.pagos) > 0
  ).length;
  const pctCobrado =
    montoTotalFacturado > 0 ? Math.round((montoTotalPagado / montoTotalFacturado) * 100) : 0;

  const cotizaciones = cliente.servicios.flatMap((s) =>
    s.cotizaciones.map((c) => ({ ...c, servicioDescripcion: s.descripcion }))
  );

  const quejasAbiertas = cliente.quejas.filter((q) => q.status !== "Resuelta" && q.status !== "Cerrada");

  const eventos: Evento[] = [
    ...pagos
      .filter((p) => p.confirmado)
      .map((p) => ({
        fecha: p.fecha,
        texto: `Pago recibido · ${formatCurrency(p.monto, p.moneda)}`,
        detalle: `${formatDate(p.fecha)}${p.confirmadoPor ? " · registró " + p.confirmadoPor.nombre : ""}`,
        color: "bg-success",
      })),
    ...cotizaciones.map((c) => ({
      fecha: c.creadoEn,
      texto: `Cotización ${c.status.toLowerCase()} · ${formatCurrency(c.montoTotal, c.moneda)}`,
      detalle: formatDate(c.creadoEn),
      color: "bg-primary",
    })),
    ...cliente.quejas.map((q) => ({
      fecha: q.creadoEn,
      texto: `Queja abierta · ${q.categoria}`,
      detalle: `${formatDate(q.creadoEn)} · ${q.status}`,
      color: "bg-destructive",
    })),
  ]
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .slice(0, 6);

  const inicial = cliente.nombre.trim().charAt(0).toUpperCase() || "?";
  const colorAvatar = cliente.etiqueta ? CLIENTE_ETIQUETA_COLOR[cliente.etiqueta] : AVATAR_DEFAULT;

  const defaultsNuevoServicio = {
    clienteId: cliente.id,
    descripcion: "",
    detalles: null,
    fechaInicio: new Date(),
    fechaFin: null,
    montoInicial: 0,
    moneda: null,
    montoInicialMXN: null,
    status: "Cotizado",
    intermediarioId: null,
    porcentajeIntermediario: null,
    responsableId: usuarioActual?.id ?? null,
  };

  function hrefTab(v: TabValue) {
    return `/admin/clientes/${cliente!.id}?tab=${v}`;
  }

  const tabTriggerClass = (v: TabValue) =>
    cn(
      "flex-none border-b-2 border-transparent px-0.5 pb-2.5 text-sm font-medium whitespace-nowrap text-white/70 hover:text-white",
      activeTab === v && "border-white text-white"
    );

  return (
    <div className="flex flex-col gap-5">
      {/* ================= HERO ================= */}
      <div className="overflow-hidden rounded-xl bg-[linear-gradient(103deg,oklch(0.24_0.045_264)_0%,oklch(0.3_0.07_268)_100%)] text-white">
        <div className="min-w-0 px-4 pt-4 sm:px-6 sm:pt-5">
          <Link
            href="/admin/clientes"
            className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
          >
            <ChevronLeft className="size-4" />
            Clientes
          </Link>

          <div className="mt-2.5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold sm:size-12 ${colorAvatar}`}
              >
                {inicial}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 text-xl font-semibold tracking-tight break-words sm:text-2xl">
                    {cliente.nombre}
                  </h1>
                  {cliente.etiqueta && (
                    <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-white/90 px-2.5 text-[11px] font-bold text-[oklch(0.3_0.08_85)]">
                      {cliente.etiqueta}
                    </span>
                  )}
                  {cliente.portalActivo && (
                    <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-white/15 px-2.5 text-[11px] font-semibold">
                      Portal activo
                    </span>
                  )}
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] break-words text-white/75">
                  {[cliente.pais, cliente.email, cliente.telefono, `Alta ${formatDate(cliente.creadoEn)}`]
                    .filter(Boolean)
                    .map((part, i) => (
                      <span key={i} className="flex min-w-0 items-center gap-2">
                        {i > 0 && <span className="opacity-50">·</span>}
                        <span className="min-w-0 break-words">{part}</span>
                      </span>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {cliente.telefono && (
                <Button
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  asChild
                >
                  <a href={whatsappHref(cliente.telefono)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    WhatsApp
                  </a>
                </Button>
              )}
              {permisos.puedeEditar && (
                <>
                  <ClienteFormDialog
                    trigger={
                      <Button
                        variant="outline"
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                      >
                        <Pencil />
                        Editar
                      </Button>
                    }
                    title="Editar cliente"
                    description={cliente.nombre}
                    action={updateCliente.bind(null, cliente.id)}
                    defaultValues={cliente}
                    submitLabel="Guardar cambios"
                  />
                  <ServicioFormDialog
                    trigger={
                      <Button className="bg-white text-[oklch(0.24_0.045_264)] hover:bg-white/90">
                        <Plus />
                        Nuevo servicio
                      </Button>
                    }
                    title="Nuevo servicio"
                    description={`Registra un nuevo servicio para ${cliente.nombre}.`}
                    action={createServicio}
                    clientes={[{ id: cliente.id, nombre: cliente.nombre }]}
                    intermediarios={intermediarios}
                    usuarios={usuarios}
                    usuarioActualId={usuarioActual?.id}
                    defaultValues={defaultsNuevoServicio}
                    submitLabel="Crear servicio"
                  />
                  <DeleteClienteButton
                    nombre={cliente.nombre}
                    action={eliminarCliente.bind(null, cliente.id)}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-5 overflow-x-auto px-4 sm:px-6">
          <Link href={hrefTab("resumen")} scroll={false} className={tabTriggerClass("resumen")}>
            Resumen
          </Link>
          <Link href={hrefTab("servicios")} scroll={false} className={tabTriggerClass("servicios")}>
            Servicios <span className="opacity-70">{totalServicios}</span>
          </Link>
          <Link href={hrefTab("cotizaciones")} scroll={false} className={tabTriggerClass("cotizaciones")}>
            Cotizaciones <span className="opacity-70">{cotizaciones.length}</span>
          </Link>
          <Link href={hrefTab("pagos")} scroll={false} className={tabTriggerClass("pagos")}>
            Pagos <span className="opacity-70">{pagos.length}</span>
          </Link>
          <Link href={hrefTab("quejas")} scroll={false} className={tabTriggerClass("quejas")}>
            Quejas{" "}
            {cliente.quejas.length > 0 && (
              <span
                className={`ml-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold ${quejasAbiertas.length > 0 ? "bg-destructive text-white" : "bg-white/15"}`}
              >
                {cliente.quejas.length}
              </span>
            )}
          </Link>
          <Link href={hrefTab("notas")} scroll={false} className={tabTriggerClass("notas")}>
            Notas y tareas
          </Link>
        </div>
      </div>

      {/* ================= RESUMEN ================= */}
      {activeTab === "resumen" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4 lg:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Estado de cuenta</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Facturado</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums sm:text-2xl">
                      {formatCurrency(montoTotalFacturado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Pagado</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-success sm:text-2xl">
                      {formatCurrency(montoTotalPagado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Saldo</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-destructive sm:text-2xl">
                      {formatCurrency(montoTotalSaldo)}
                    </p>
                  </div>
                </div>
                {montoTotalFacturado > 0 && (
                  <div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <div className="bg-success" style={{ width: `${Math.min(pctCobrado, 100)}%` }} />
                      <div className="bg-destructive" style={{ width: `${Math.max(100 - pctCobrado, 0)}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{pctCobrado}% cobrado</span>
                      {serviciosConSaldo > 0 && (
                        <span>
                          {serviciosConSaldo} servicio{serviciosConSaldo === 1 ? "" : "s"} con saldo
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-baseline justify-between space-y-0">
                <CardTitle className="text-sm font-medium">
                  Servicios activos <span className="font-normal text-muted-foreground">{serviciosActivos.length}</span>
                </CardTitle>
                {totalServicios > serviciosActivos.length && (
                  <Link href={hrefTab("servicios")} scroll={false} className="text-xs font-semibold text-primary hover:underline">
                    Ver todos
                  </Link>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-0 p-0">
                {serviciosActivos.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">Sin servicios activos.</p>
                ) : (
                  serviciosActivos.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3.5 border-t border-border px-4 py-3 first:border-t-0"
                    >
                      <span className={`size-2 shrink-0 rounded-full ${SERVICIO_STATUS_BAR[s.status]}`} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/servicios/${s.id}`} className="truncate text-sm font-medium hover:underline">
                          {s.descripcion}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {[s.responsable ? `Responsable: ${s.responsable.nombre}` : null, s.fechaFin ? `vence ${formatDate(s.fechaFin)}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold sm:inline-flex ${SERVICIO_STATUS_COLOR[s.status]}`}>
                        {s.status}
                      </span>
                      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(montoTotalServicio(s), s.moneda)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Actividad reciente</CardTitle>
              </CardHeader>
              <CardContent>
                {eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
                ) : (
                  <div className="flex flex-col">
                    {eventos.map((e, i) => (
                      <div key={i} className="flex gap-3.5 py-2.5">
                        <div className="flex flex-col items-center">
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.color}`} />
                          {i < eventos.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="text-sm">{e.texto}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{e.detalle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Contacto</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3.5 text-sm">
                <div className="grid gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">País</p>
                    <p className="mt-0.5">{cliente.pais ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Teléfono</p>
                    <p className="mt-0.5">{cliente.telefono ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Email</p>
                    <p className="mt-0.5 break-words">{cliente.email ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Medio de captación</p>
                    <p className="mt-0.5">{cliente.medioCaptacion ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Código de referido</p>
                    <p className="mt-0.5">{cliente.codigoReferido ?? "—"}</p>
                  </div>
                </div>

                {(cliente.email || cliente.telefono) && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border pt-3.5">
                    {cliente.email && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={mailtoHref(cliente.email)}>
                          <Mail />
                          Correo
                        </a>
                      </Button>
                    )}
                    {cliente.telefono && (
                      <Button size="sm" asChild>
                        <a
                          href={whatsappHref(cliente.telefono, mensajeAgendarCita(cliente.nombre))}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <CalendarDays />
                          Agendar
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {(montoTotalSaldo > 0 || quejasAbiertas.length > 0) && (
              <Card className="border-destructive/25 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <ShieldAlert className="size-4" />
                    Requiere atención
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm text-destructive/90">
                  {montoTotalSaldo > 0 && (
                    <p>
                      Saldo pendiente en {serviciosConSaldo} servicio{serviciosConSaldo === 1 ? "" : "s"} —{" "}
                      {formatCurrency(montoTotalSaldo)}
                    </p>
                  )}
                  {quejasAbiertas.length > 0 && (
                    <Link href={hrefTab("quejas")} scroll={false} className="text-left hover:underline">
                      {quejasAbiertas.length} queja{quejasAbiertas.length === 1 ? "" : "s"} abierta
                      {quejasAbiertas.length === 1 ? "" : "s"} sin resolver
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Tareas</CardTitle>
                <TareaFormDialog
                  action={crearTarea}
                  vinculoFijo={{ value: `cliente:${cliente.id}`, label: cliente.nombre }}
                  usuarios={usuarios}
                  usuarioActualId={usuarioActual?.id}
                  triggerLabel="+ Añadir"
                  title={`Nuevo recordatorio — ${cliente.nombre}`}
                  description="Ej. mandar WhatsApp de seguimiento, llamar, mandar propuesta."
                />
              </CardHeader>
              <CardContent>
                <TareaLista
                  tareas={cliente.tareas.slice(0, 3)}
                  emptyText="Sin recordatorios pendientes con este cliente."
                />
                {cliente.tareas.length > 3 && (
                  <Link
                    href={hrefTab("notas")}
                    scroll={false}
                    className="mt-2.5 block text-xs font-semibold text-primary hover:underline"
                  >
                    Ver las {cliente.tareas.length}
                  </Link>
                )}
              </CardContent>
            </Card>

            {cliente.notas && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Notas internas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{cliente.notas}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ================= SERVICIOS ================= */}
      {activeTab === "servicios" && (
        <Card>
          <CardContent>
            {cliente.servicios.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Este cliente aún no tiene servicios registrados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Intermediario</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cliente.servicios.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/servicios/${s.id}`} className="hover:underline">
                          {s.descripcion}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold ${SERVICIO_STATUS_COLOR[s.status]}`}>
                          {s.status}
                        </span>
                      </TableCell>
                      <TableCell>{s.responsable?.nombre ?? "—"}</TableCell>
                      <TableCell>{s.intermediario?.nombre ?? "—"}</TableCell>
                      <TableCell>{formatDate(s.fechaInicio)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(montoTotalServicio(s), s.moneda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================= COTIZACIONES ================= */}
      {activeTab === "cotizaciones" && (
        <Card>
          <CardContent>
            {cotizaciones.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Este cliente aún no tiene cotizaciones.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Emisión</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotizaciones.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/cotizaciones/${c.id}`} className="hover:underline">
                          {c.servicioDescripcion}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold ${COTIZACION_STATUS_COLOR[c.status]}`}>
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(c.fechaEmision)}</TableCell>
                      <TableCell>{formatDate(c.fechaVencimiento)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(c.montoTotal, c.moneda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================= PAGOS ================= */}
      {activeTab === "pagos" && (
        <Card>
          <CardContent>
            {pagos.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Este cliente aún no tiene pagos registrados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.servicioDescripcion}</TableCell>
                      <TableCell>{formatDate(p.fecha)}</TableCell>
                      <TableCell>{p.metodoPago}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold ${p.confirmado ? CONFIRMADO_COLOR : PENDIENTE_COLOR}`}
                        >
                          {p.confirmado ? "Confirmado" : "Pendiente"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.monto, p.moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================= QUEJAS ================= */}
      {activeTab === "quejas" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              {cliente.quejas.length} queja{cliente.quejas.length === 1 ? "" : "s"}
            </CardTitle>
            <QuejaFormDialog action={crearQueja} clienteFijo={clienteFijoOpcion} />
          </CardHeader>
          <CardContent>
            {cliente.quejas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este cliente no ha registrado quejas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cliente.quejas.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>{q.categoria}</TableCell>
                      <TableCell className="max-w-xs truncate">{q.descripcion}</TableCell>
                      <TableCell>
                        <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold ${QUEJA_STATUS_COLOR[q.status]}`}>
                          {q.status}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(q.creadoEn)}</TableCell>
                      <TableCell>
                        <QuejaDetalleDialog
                          queja={{
                            id: q.id,
                            categoria: q.categoria,
                            descripcion: q.descripcion,
                            status: q.status,
                            respuesta: q.respuesta,
                            creadoEn: q.creadoEn,
                            respondidoEn: q.respondidoEn,
                            cliente: { nombre: cliente.nombre },
                            servicio: q.servicio ? { descripcion: q.servicio.descripcion } : null,
                            asignadoAId: q.asignadoAId,
                          }}
                          action={actualizarQueja.bind(null, q.id)}
                          usuarios={usuarios}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================= NOTAS Y TAREAS ================= */}
      {activeTab === "notas" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">
                Seguimiento ({cliente.tareas.length})
              </CardTitle>
              <TareaFormDialog
                action={crearTarea}
                vinculoFijo={{ value: `cliente:${cliente.id}`, label: cliente.nombre }}
                usuarios={usuarios}
                usuarioActualId={usuarioActual?.id}
                triggerLabel="+ Recordatorio"
                title={`Nuevo recordatorio — ${cliente.nombre}`}
                description="Ej. mandar WhatsApp de seguimiento, llamar, mandar propuesta."
              />
            </CardHeader>
            <CardContent>
              <TareaLista tareas={cliente.tareas} emptyText="Sin recordatorios pendientes con este cliente." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Notas internas</CardTitle>
            </CardHeader>
            <CardContent>
              {cliente.notas ? (
                <p className="text-sm whitespace-pre-wrap">{cliente.notas}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin notas — agrégalas desde &quot;Editar&quot;.
                </p>
              )}
            </CardContent>
          </Card>

          <PortalAccessCard
            email={cliente.email}
            portalActivo={cliente.portalActivo}
            ultimoAcceso={cliente.ultimoAccesoPortal ? formatDate(cliente.ultimoAccesoPortal) : null}
            guardarPassword={guardarPasswordPortalCliente.bind(null, cliente.id)}
            desactivar={desactivarPortalCliente.bind(null, cliente.id)}
          />
        </div>
      )}
    </div>
  );
}
