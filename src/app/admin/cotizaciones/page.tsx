import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus, Download, Send } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio } from "@/lib/servicio";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { COTIZACION_STATUS_COLOR as STATUS_COLOR, COTIZACION_STATUS_ICON as STATUS_ICON } from "@/lib/status-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog";
import { crearCotizacion } from "@/app/admin/cotizaciones/actions";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/pagination";
import type { Prisma, StatusCotizacion } from "@/generated/prisma/client";

const STATUSES = ["Enviada", "Firmada", "Pagada", "Vencida", "Perdida"];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; status?: string; page?: string }>;
}) {
  const { clienteId, status, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Cotizaciones");
  if (!permisos.puedeVer) redirect("/admin");

  const [clientes, serviciosParaCotizar] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.servicio.findMany({
      include: { cliente: true, ordenesCambio: true },
      orderBy: { creadoEn: "desc" },
    }),
  ]);

  const servicioOpciones = serviciosParaCotizar.map((s) => ({
    id: s.id,
    descripcion: s.descripcion,
    clienteNombre: s.cliente.nombre,
    montoTotal: montoTotalServicio(s),
    ordenesCambio: s.ordenesCambio.map((o) => ({
      id: o.id,
      descripcion: o.descripcion,
      monto: Number(o.monto),
      status: o.status,
    })),
  }));

  const where: Prisma.CotizacionWhereInput = {};
  if (clienteId) where.clienteId = Number(clienteId);
  if (status) where.status = status as StatusCotizacion;

  const hasFiltros = Boolean(clienteId || status);

  const exportParams = new URLSearchParams();
  if (clienteId) exportParams.set("clienteId", clienteId);
  if (status) exportParams.set("status", status);

  const [totalCount, cotizaciones] = await Promise.all([
    prisma.cotizacion.count({ where }),
    prisma.cotizacion.findMany({
      where,
      include: { cliente: true, servicio: true },
      orderBy: { creadoEn: "desc" },
      skip: paginationSkip(page),
      take: PAGE_SIZE,
    }),
  ]);
  const paginas = totalPages(totalCount);

  function buildHref(targetPage: number) {
    const params = new URLSearchParams();
    if (clienteId) params.set("clienteId", clienteId);
    if (status) params.set("status", status);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/cotizaciones?${qs}` : "/admin/cotizaciones";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} cotización{totalCount === 1 ? "" : "es"}
            {hasFiltros ? " con estos filtros" : " registrada" + (totalCount === 1 ? "" : "s")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/cotizaciones/export?${exportParams.toString()}`}>
              <Download />
              Exportar Excel
            </a>
          </Button>
          {permisos.puedeCrear &&
            (clientes.length > 0 ? (
              <CotizacionFormDialog
                trigger={
                  <Button>
                    <Plus />
                    Nueva cotización
                  </Button>
                }
                title="Nueva cotización"
                description="Para un servicio existente, o una nueva negociación con un cliente."
                action={crearCotizacion}
                servicios={servicioOpciones.length > 0 ? servicioOpciones : undefined}
                clientes={clientes}
                submitLabel="Crear cotización"
              />
            ) : (
              <Button disabled title="Primero registra un cliente">
                <Plus />
                Nueva cotización
              </Button>
            ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select name="clienteId" defaultValue={clienteId ?? ""} className={selectClass}>
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <select name="status" defaultValue={status ?? ""} className={selectClass}>
              <option value="">Todos los status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/cotizaciones">Limpiar</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros
                ? "No hay cotizaciones con esos filtros."
                : "Aún no hay cotizaciones registradas."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden table-fixed md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-4/12">Servicio</TableHead>
                    <TableHead className="w-2/12">Cliente</TableHead>
                    <TableHead className="w-2/12">Status</TableHead>
                    <TableHead className="w-1/12">Emisión</TableHead>
                    <TableHead className="w-1/12">Vencimiento</TableHead>
                    <TableHead className="w-1/12 text-right">Monto</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotizaciones.map((c) => {
                    const Icono = STATUS_ICON[c.status] ?? Send;
                    return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/cotizaciones/${c.id}`}
                            className="flex min-w-0 items-center gap-2.5 hover:underline"
                            title={c.servicio?.descripcion ?? c.descripcion ?? "Sin servicio"}
                          >
                            <span
                              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${STATUS_COLOR[c.status]}`}
                            >
                              <Icono className="size-3.5" />
                            </span>
                            <span className="truncate">
                              {c.servicio?.descripcion ?? c.descripcion ?? "Sin servicio"}
                            </span>
                          </Link>
                          {!c.servicioId && (
                            <Badge variant="outline" className="shrink-0">
                              En negociación
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="truncate">
                        <Link
                          href={`/admin/clientes/${c.cliente.id}`}
                          className="hover:underline"
                        >
                          {c.cliente.nombre}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLOR[c.status]}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="truncate">{formatDate(c.fechaEmision)}</TableCell>
                      <TableCell>{formatDate(c.fechaVencimiento)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.montoTotal)}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/cotizaciones/${c.id}`}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Ver detalle de la cotización ${c.id}`}
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {cotizaciones.map((c) => {
                  const Icono = STATUS_ICON[c.status] ?? Send;
                  return (
                    <MobileRecordCard
                      key={c.id}
                      href={`/admin/cotizaciones/${c.id}`}
                      avatarLabel={<Icono className="size-5" />}
                      avatarClassName={STATUS_COLOR[c.status]}
                      title={c.servicio?.descripcion ?? c.descripcion ?? "Sin servicio"}
                      subtitle={c.cliente.nombre}
                      meta={`${formatDate(c.fechaEmision)} · ${formatCurrency(c.montoTotal)}`}
                      badge={
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[c.status]}`}
                        >
                          {c.status}
                        </span>
                      }
                    />
                  );
                })}
              </div>

              <div className="mt-4">
                <Pagination
                  page={page}
                  totalPages={paginas}
                  totalCount={totalCount}
                  pageSize={PAGE_SIZE}
                  buildHref={buildHref}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
