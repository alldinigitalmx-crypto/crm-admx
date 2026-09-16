import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronRight, Download, FileText } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio, montoPendienteServicio } from "@/lib/servicio";
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
import { StatusQuickSelect } from "@/components/servicios/status-quick-select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { createServicio, cambiarStatusServicio } from "@/app/admin/servicios/actions";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/pagination";
import type { Prisma, StatusServicio } from "@/generated/prisma/client";

const STATUSES = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"];

const ORDENES = [
  { value: "recientes", label: "Más recientes" },
  { value: "pendiente_desc", label: "Saldo pendiente (mayor primero)" },
  { value: "pendiente_asc", label: "Saldo pendiente (menor primero)" },
] as const;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{
    clienteId?: string | string[];
    status?: string | string[];
    intermediarioId?: string | string[];
    orden?: string;
    solo?: string;
    page?: string;
  }>;
}) {
  const { clienteId, status, intermediarioId, orden, solo, page: pageParam } = await searchParams;
  const clienteIds = toArray(clienteId);
  const statuses = toArray(status);
  const intermediarioIds = toArray(intermediarioId);
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
  if (clienteIds.length) where.clienteId = { in: clienteIds.map(Number) };
  if (statuses.length) where.status = { in: statuses as StatusServicio[] };
  if (intermediarioIds.length) where.intermediarioId = { in: intermediarioIds.map(Number) };
  if (!verTodo && usuario) where.responsableId = usuario.id;

  const hasFiltros = Boolean(clienteIds.length || statuses.length || intermediarioIds.length);

  const exportParams = new URLSearchParams();
  clienteIds.forEach((v) => exportParams.append("clienteId", v));
  statuses.forEach((v) => exportParams.append("status", v));
  intermediarioIds.forEach((v) => exportParams.append("intermediarioId", v));

  // El saldo pendiente/liquidado se calcula en memoria (montoPendienteServicio
  // depende de órdenes de cambio y pagos, no es una columna) -- por eso el
  // filtro "solo" y el orden por pendiente se resuelven aquí, no en Prisma,
  // y la paginación se hace con slice() sobre el arreglo ya filtrado/ordenado.
  const todos = await prisma.servicio.findMany({
    where,
    include: {
      cliente: true,
      intermediario: true,
      ordenesCambio: true,
      pagos: { select: { monto: true, confirmado: true, moneda: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  const conPendiente = todos.map((s) => ({ s, pendiente: montoPendienteServicio(s, s.pagos) }));

  const filtrados =
    solo === "pendientes"
      ? conPendiente.filter((x) => x.pendiente > 0.01)
      : solo === "liquidados"
        ? conPendiente.filter((x) => x.pendiente <= 0.01)
        : conPendiente;

  if (orden === "pendiente_desc") filtrados.sort((a, b) => b.pendiente - a.pendiente);
  else if (orden === "pendiente_asc") filtrados.sort((a, b) => a.pendiente - b.pendiente);

  const totalCount = filtrados.length;
  const paginas = totalPages(totalCount);
  const servicios = filtrados
    .slice(paginationSkip(page), paginationSkip(page) + PAGE_SIZE)
    .map((x) => ({ ...x.s, pendienteCalculado: x.pendiente }));

  function buildHref(targetPage: number) {
    const params = new URLSearchParams();
    clienteIds.forEach((v) => params.append("clienteId", v));
    statuses.forEach((v) => params.append("status", v));
    intermediarioIds.forEach((v) => params.append("intermediarioId", v));
    if (orden) params.set("orden", orden);
    if (solo) params.set("solo", solo);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/servicios?${qs}` : "/admin/servicios";
  }

  function buildQuickHref(soloValue: string | null) {
    const params = new URLSearchParams();
    clienteIds.forEach((v) => params.append("clienteId", v));
    statuses.forEach((v) => params.append("status", v));
    intermediarioIds.forEach((v) => params.append("intermediarioId", v));
    if (soloValue === "pendientes") {
      params.set("solo", "pendientes");
      params.set("orden", "pendiente_desc");
    } else if (soloValue === "liquidados") {
      params.set("solo", "liquidados");
    }
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
            {hasFiltros || solo ? " con estos filtros" : " registrado" + (totalCount === 1 ? "" : "s")}
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

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!solo ? "secondary" : "outline"} asChild>
          <Link href={buildQuickHref(null)}>Todos</Link>
        </Button>
        <Button size="sm" variant={solo === "pendientes" ? "secondary" : "outline"} asChild>
          <Link href={buildQuickHref("pendientes")}>Con saldo pendiente</Link>
        </Button>
        <Button size="sm" variant={solo === "liquidados" ? "secondary" : "outline"} asChild>
          <Link href={buildQuickHref("liquidados")}>Liquidados</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MultiSelectFilter
                key={`cliente-${clienteIds.join(",")}`}
                name="clienteId"
                label="Clientes"
                options={clientes.map((c) => ({ value: String(c.id), label: c.nombre }))}
                defaultSelected={clienteIds}
              />

              <MultiSelectFilter
                key={`status-${statuses.join(",")}`}
                name="status"
                label="Status"
                options={STATUSES.map((s) => ({ value: s, label: s }))}
                defaultSelected={statuses}
              />

              <MultiSelectFilter
                key={`intermediario-${intermediarioIds.join(",")}`}
                name="intermediarioId"
                label="Intermediarios"
                options={intermediarios.map((i) => ({ value: String(i.id), label: i.nombre }))}
                defaultSelected={intermediarioIds}
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Ordenar por</span>
                <select name="orden" defaultValue={orden ?? "recientes"} className={selectClass}>
                  {ORDENES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {solo && <input type="hidden" name="solo" value={solo} />}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {(hasFiltros || orden || solo) && (
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
              {hasFiltros || solo
                ? "No hay servicios con esos filtros."
                : "Aún no hay servicios registrados."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden table-fixed md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-3/12">Descripción</TableHead>
                    <TableHead className="w-2/12">Cliente</TableHead>
                    <TableHead className="w-2/12">Status</TableHead>
                    <TableHead className="w-2/12">Intermediario</TableHead>
                    <TableHead className="w-1/12">Inicio</TableHead>
                    <TableHead className="w-1/12 text-right">Monto</TableHead>
                    <TableHead className="w-1/12 text-right">Pendiente</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicios.map((s) => {
                    const Icono = STATUS_ICON[s.status] ?? FileText;
                    const pendiente = s.pendienteCalculado;
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
                        {permisos.puedeEditar ? (
                          <StatusQuickSelect servicioId={s.id} status={s.status} action={cambiarStatusServicio} />
                        ) : (
                          <Badge className={STATUS_COLOR[s.status]}>{s.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="truncate">{s.intermediario?.nombre ?? "—"}</TableCell>
                      <TableCell className="truncate">{formatDate(s.fechaInicio)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(montoTotalServicio(s), s.moneda)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${pendiente > 0.01 ? "font-medium text-destructive" : "text-success"}`}
                      >
                        {pendiente > 0.01 ? formatCurrency(pendiente, s.moneda) : "Liquidado"}
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
                  const pendiente = s.pendienteCalculado;
                  return (
                    <MobileRecordCard
                      key={s.id}
                      href={`/admin/servicios/${s.id}`}
                      avatarLabel={<Icono className="size-5" />}
                      avatarClassName={STATUS_COLOR[s.status]}
                      title={s.descripcion}
                      subtitle={s.cliente.nombre}
                      meta={`${formatDate(s.fechaInicio)} · ${formatCurrency(montoTotalServicio(s), s.moneda)} · ${
                        pendiente > 0.01 ? `pendiente ${formatCurrency(pendiente, s.moneda)}` : "liquidado"
                      }`}
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
