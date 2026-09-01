import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import { PRIORIDAD_COLOR } from "@/lib/status-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/pagination";
import { completarTarea, eliminarTarea } from "@/app/admin/tareas/actions";
import type { Prisma } from "@/generated/prisma/client";

function vinculoLabel(tarea: {
  servicio: { descripcion: string } | null;
  cotizacion: { cliente: { nombre: string } | null; prospectoNombre: string | null } | null;
  cliente: { nombre: string } | null;
}) {
  if (tarea.servicio) return `💼 ${tarea.servicio.descripcion}`;
  if (tarea.cotizacion) return `📄 ${nombreClienteCotizacion(tarea.cotizacion)}`;
  if (tarea.cliente) return `👤 ${tarea.cliente.nombre}`;
  return "📌 Suelta";
}

export default async function TareasHistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; desde?: string; hasta?: string }>;
}) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Tareas");
  if (!permisos.puedeVer) redirect("/admin");

  const { page: pageParam, desde, hasta } = await searchParams;
  const page = parsePage(pageParam);

  const where: Prisma.TareaWhereInput = {
    ...(!permisos.verTodo && usuario ? { asignadoAId: usuario.id } : {}),
    completada: true,
  };
  if (desde || hasta) {
    where.completadaEn = {
      ...(desde ? { gte: new Date(`${desde}T00:00:00`) } : {}),
      ...(hasta ? { lte: new Date(`${hasta}T23:59:59.999`) } : {}),
    };
  }

  const [totalCount, tareas] = await Promise.all([
    prisma.tarea.count({ where }),
    prisma.tarea.findMany({
      where,
      orderBy: { completadaEn: "desc" },
      skip: paginationSkip(page),
      take: PAGE_SIZE,
      include: {
        servicio: { select: { descripcion: true } },
        cotizacion: { select: { cliente: { select: { nombre: true } }, prospectoNombre: true } },
        cliente: { select: { nombre: true } },
        asignadoA: { select: { nombre: true } },
      },
    }),
  ]);
  const paginas = totalPages(totalCount);

  function buildHref(targetPage: number) {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/tareas/historial?${qs}` : "/admin/tareas/historial";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/tareas"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Tareas
        </Link>
        <h1 className="text-2xl font-semibold">Historial de tareas</h1>
        <p className="text-sm text-muted-foreground">
          {totalCount} tarea{totalCount === 1 ? "" : "s"} completada{totalCount === 1 ? "" : "s"}{" "}
          — el tablero de todos los días solo muestra las de los últimos 14 días
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtrar por fecha</CardTitle>
        </CardHeader>
        <CardContent>
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

      <Card>
        <CardContent>
          {tareas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay tareas completadas en este rango.
            </p>
          ) : (
            <>
              {/* Escritorio */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarea</TableHead>
                      <TableHead>Vínculo</TableHead>
                      <TableHead>Asignada a</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Completada el</TableHead>
                      {permisos.puedeEditar && <TableHead className="w-20" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tareas.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-64 truncate">{t.titulo}</TableCell>
                        <TableCell className="max-w-48 truncate text-muted-foreground">
                          {vinculoLabel(t)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.asignadoA?.nombre ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={PRIORIDAD_COLOR[t.prioridad]}>{t.prioridad}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(t.completadaEn)}
                        </TableCell>
                        {permisos.puedeEditar && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <form action={completarTarea.bind(null, t.id, false)}>
                                <Button
                                  type="submit"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title="Reabrir tarea"
                                >
                                  <RotateCcw className="size-3.5" />
                                </Button>
                              </form>
                              <form action={eliminarTarea.bind(null, t.id)}>
                                <Button
                                  type="submit"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-destructive hover:text-destructive"
                                  title="Eliminar"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </form>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Móvil */}
              <div className="flex flex-col gap-2 md:hidden">
                {tareas.map((t) => (
                  <MobileRecordCard
                    key={t.id}
                    avatarLabel={vinculoLabel(t).slice(0, 2)}
                    title={t.titulo}
                    subtitle={vinculoLabel(t).slice(2).trim()}
                    meta={`${t.asignadoA?.nombre ?? "Sin asignar"} · ${formatDate(t.completadaEn)}`}
                    badge={
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORIDAD_COLOR[t.prioridad]}`}
                      >
                        {t.prioridad}
                      </span>
                    }
                    actions={
                      permisos.puedeEditar && (
                        <>
                          <form action={completarTarea.bind(null, t.id, false)}>
                            <Button type="submit" size="sm" variant="outline">
                              <RotateCcw />
                              Reabrir
                            </Button>
                          </form>
                          <form action={eliminarTarea.bind(null, t.id)}>
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 />
                              Eliminar
                            </Button>
                          </form>
                        </>
                      )
                    }
                  />
                ))}
              </div>

              <div className="mt-3">
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
