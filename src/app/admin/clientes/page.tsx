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
import type { Etiqueta, Prisma } from "@/generated/prisma/client";

const ETIQUETAS = ["VIP", "Premium", "Platinum"];

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// Colores por etiqueta — se reutilizan en el avatar y el badge de la
// tarjeta móvil para que la etiqueta se distinga de un vistazo, como en
// una vista Deck de AppSheet coloreada por enum.
const ETIQUETA_COLOR: Record<string, string> = {
  VIP: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Premium: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  Platinum: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};
const AVATAR_DEFAULT = "bg-blue-600/10 text-blue-600 dark:text-blue-400";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etiqueta?: string }>;
}) {
  const { q, etiqueta } = await searchParams;
  const query = q?.trim();

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

  const clientes = await prisma.cliente.findMany({
    where,
    orderBy: { creadoEn: "desc" },
  });

  const hasFiltros = Boolean(query || etiqueta);

  const exportParams = new URLSearchParams();
  if (query) exportParams.set("q", query);
  if (etiqueta) exportParams.set("etiqueta", etiqueta);

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
            {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
            {hasFiltros ? " con estos filtros" : " registrado" + (clientes.length === 1 ? "" : "s")}
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
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/clientes/${c.id}`}
                            className="hover:underline"
                          >
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
