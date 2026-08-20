import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronRight, Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
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
import { Input } from "@/components/ui/input";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { createCliente } from "@/app/admin/clientes/actions";
import { CLIENTE_ETIQUETA_COLOR as ETIQUETA_COLOR } from "@/lib/status-colors";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage, paginationSkip, totalPages } from "@/lib/pagination";
import type { Etiqueta, Prisma } from "@/generated/prisma/client";

const ETIQUETAS = ["VIP", "Premium", "Platinum"];

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const AVATAR_DEFAULT = "bg-primary/10 text-primary";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etiqueta?: string; page?: string }>;
}) {
  const { q, etiqueta, page: pageParam } = await searchParams;
  const query = q?.trim();
  const page = parsePage(pageParam);

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Clientes");
  if (!permisos.puedeVer) redirect("/admin");

  const where: Prisma.ClienteWhereInput = {};
  if (query) {
    where.OR = [
      { nombre: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { pais: { contains: query, mode: "insensitive" } },
    ];
  }
  if (etiqueta === "ninguna") {
    where.etiqueta = null;
  } else if (etiqueta) {
    where.etiqueta = etiqueta as Etiqueta;
  }

  const [totalCount, clientes] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      skip: paginationSkip(page),
      take: PAGE_SIZE,
    }),
  ]);
  const paginas = totalPages(totalCount);

  const hasFiltros = Boolean(query || etiqueta);

  const exportParams = new URLSearchParams();
  if (query) exportParams.set("q", query);
  if (etiqueta) exportParams.set("etiqueta", etiqueta);

  function buildHref(targetPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (etiqueta) params.set("etiqueta", etiqueta);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/clientes?${qs}` : "/admin/clientes";
  }

  const verTodo = permisos.verTodo;
  let clientesPropios: Set<number> | null = null;
  if (!verTodo && usuario) {
    const servicios = await prisma.servicio.findMany({
      where: { responsableId: usuario.id },
      select: { clienteId: true },
    });
    clientesPropios = new Set(servicios.map((s) => s.clienteId));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} cliente{totalCount === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrado" + (totalCount === 1 ? "" : "s")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/admin/clientes/export?${exportParams.toString()}`}>
              <Download />
              Exportar Excel
            </a>
          </Button>
          {permisos.puedeCrear && (
            <ClienteFormDialog
              trigger={
                <Button>
                  <Plus />
                  Nuevo cliente
                </Button>
              }
              title="Nuevo cliente"
              description="Registra un nuevo cliente en el sistema."
              action={createCliente}
              submitLabel="Crear cliente"
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-sm font-medium">Listado</CardTitle>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Input
              type="search"
              name="q"
              placeholder="Buscar por nombre, email o país..."
              defaultValue={query ?? ""}
            />
            <select name="etiqueta" defaultValue={etiqueta ?? ""} className={selectClass}>
              <option value="">Todas las etiquetas</option>
              {ETIQUETAS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
              <option value="ninguna">Sin etiqueta</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/clientes">Limpiar</Link>
                </Button>
              )}
            </div>
          </form>
        </CardHeader>
        <CardContent>
          {clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros
                ? "No hay clientes con esos filtros."
                : "Aún no hay clientes registrados."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Captación</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c) => {
                    const esPropio = !clientesPropios || clientesPropios.has(c.id);
                    const inicialFila = c.nombre.trim().charAt(0).toUpperCase() || "?";
                    const colorFila = c.etiqueta ? ETIQUETA_COLOR[c.etiqueta] : undefined;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/clientes/${c.id}`}
                            className="flex items-center gap-2.5 hover:underline"
                          >
                            <span
                              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorFila ?? AVATAR_DEFAULT}`}
                            >
                              {inicialFila}
                            </span>
                            {c.nombre}
                          </Link>
                        </TableCell>
                        {esPropio ? (
                          <>
                            <TableCell>
                              {c.etiqueta ? (
                                <Badge variant="outline">{c.etiqueta}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>{c.pais ?? "—"}</TableCell>
                            <TableCell>{c.email ?? "—"}</TableCell>
                            <TableCell>{c.medioCaptacion ?? "—"}</TableCell>
                          </>
                        ) : (
                          <TableCell colSpan={4} className="text-muted-foreground">
                            No tienes servicios asignados de este cliente
                          </TableCell>
                        )}
                        <TableCell>
                          <Link
                            href={`/admin/clientes/${c.id}`}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Ver detalle de ${c.nombre}`}
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {clientes.map((c) => {
                  const esPropio = !clientesPropios || clientesPropios.has(c.id);
                  const inicial = c.nombre.trim().charAt(0).toUpperCase() || "?";
                  const colorEtiqueta = c.etiqueta ? ETIQUETA_COLOR[c.etiqueta] : undefined;
                  return (
                    <MobileRecordCard
                      key={c.id}
                      href={`/admin/clientes/${c.id}`}
                      avatarLabel={inicial}
                      avatarClassName={colorEtiqueta ?? AVATAR_DEFAULT}
                      title={c.nombre}
                      subtitle={
                        esPropio
                          ? [c.pais, c.medioCaptacion].filter(Boolean).join(" · ") || undefined
                          : "No tienes servicios asignados de este cliente"
                      }
                      meta={esPropio ? (c.email ?? undefined) : undefined}
                      badge={
                        esPropio && c.etiqueta ? (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ETIQUETA_COLOR[c.etiqueta]}`}
                          >
                            {c.etiqueta}
                          </span>
                        ) : undefined
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
