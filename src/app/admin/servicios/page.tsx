import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronRight, Download, FileText } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio } from "@/lib/servicio";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { SERVICIO_STATUS_COLOR as STATUS_COLOR, SERVICIO_STATUS_ICON as STATUS_ICON } from "@/lib/status-colors";
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
import { ServicioFormDialog } from "@/components/servicios/servicio-form-dialog";
import { createServicio } from "@/app/admin/servicios/actions";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/pagination";
import type { Prisma, StatusServicio } from "@/generated/prisma/client";

const STATUSES = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{
    clienteId?: string;
    status?: string;
    intermediarioId?: string;
    desde?: string;
    hasta?: string;
    page?: string;
  }>;
}) {
  const { clienteId, status, intermediarioId, desde, hasta, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const [clientes, intermediarios, usuarios, usuario] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.intermediario.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    currentUsuario(),
  ]);

  const permisos = await permisosModulo(usuario, "Servicios");
  if (!permisos.puedeVer) redirect("/admin");
  const verTodo = permisos.verTodo;

  const where: Prisma.ServicioWhereInput = {};
  if (clienteId) where.clienteId = Number(clienteId);
  if (status) where.status = status as StatusServicio;
  if (intermediarioId) where.intermediarioId = Number(intermediarioId);
  if (desde || hasta) {
    where.fechaInicio = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }
  if (!verTodo && usuario) where.responsableId = usuario.id;

  const hasFiltros = Boolean(clienteId || status || intermediarioId || desde || hasta);

  const exportParams = new URLSearchParams();
  if (clienteId) exportParams.set("clienteId", clienteId);
  if (status) exportParams.set("status", status);
  if (intermediarioId) exportParams.set("intermediarioId", intermediarioId);
  if (desde) exportParams.set("desde", desde);
  if (hasta) exportParams.set("hasta", hasta);

  const [totalCount, servicios] = await Promise.all([
    prisma.servicio.count({ where }),
    prisma.servicio.findMany({
      where,
      include: { cliente: true, intermediario: true, ordenesCambio: true },
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
    if (intermediarioId) params.set("intermediarioId", intermediarioId);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/servicios?${qs}` : "/admin/servicios";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} servicio{totalCount === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrado" + (totalCount === 1 ? "" : "s")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/servicios/export?${exportParams.toString()}`}>
              <Download />
              Exportar Excel
            </a>
          </Button>
          {permisos.puedeCrear && (
            <ServicioFormDialog
              trigger={
                <Button>
                  <Plus />
                  Nuevo servicio
                </Button>
              }
              title="Nuevo servicio"
              description="Registra un nuevo servicio o trabajo."
              action={createServicio}
              clientes={clientes}
              intermediarios={intermediarios}
              usuarios={usuarios}
              usuarioActualId={usuario?.id}
              submitLabel="Crear servicio"
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

            <select
              name="intermediarioId"
              defaultValue={intermediarioId ?? ""}
              className={selectClass}
            >
              <option value="">Todos los intermediarios</option>
              {intermediarios.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>

            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              aria-label="Desde"
              className={selectClass}
            />
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              aria-label="Hasta"
              className={selectClass}
            />

            <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/servicios">Limpiar</Link>
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
          {servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros
                ? "No hay servicios con esos filtros."
                : "Aún no hay servicios registrados."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden table-fixed md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-4/12">Descripción</TableHead>
                    <TableHead className="w-2/12">Cliente</TableHead>
                    <TableHead className="w-2/12">Status</TableHead>
                    <TableHead className="w-2/12">Intermediario</TableHead>
                    <TableHead className="w-1/12">Inicio</TableHead>
                    <TableHead className="w-1/12 text-right">Monto</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicios.map((s) => {
                    const Icono = STATUS_ICON[s.status] ?? FileText;
                    return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/servicios/${s.id}`}
                          className="flex items-center gap-2.5 hover:underline"
                          title={s.descripcion}
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${STATUS_COLOR[s.status]}`}
                          >
                            <Icono className="size-3.5" />
                          </span>
                          <span className="truncate">{s.descripcion}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="truncate">
                        <Link
                          href={`/admin/clientes/${s.cliente.id}`}
                          className="hover:underline"
                        >
                          {s.cliente.nombre}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLOR[s.status]}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="truncate">{s.intermediario?.nombre ?? "—"}</TableCell>
                      <TableCell className="truncate">{formatDate(s.fechaInicio)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(montoTotalServicio(s))}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/servicios/${s.id}`}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Ver detalle de ${s.descripcion}`}
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
                {servicios.map((s) => {
                  const Icono = STATUS_ICON[s.status] ?? FileText;
                  return (
                    <MobileRecordCard
                      key={s.id}
                      href={`/admin/servicios/${s.id}`}
                      avatarLabel={<Icono className="size-5" />}
                      avatarClassName={STATUS_COLOR[s.status]}
                      title={s.descripcion}
                      subtitle={s.cliente.nombre}
                      meta={`${formatDate(s.fechaInicio)} · ${formatCurrency(montoTotalServicio(s))}`}
                      badge={
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[s.status]}`}
                        >
                          {s.status}
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
