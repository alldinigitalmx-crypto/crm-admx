import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, FileText, Code2, Package } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
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
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { ProductoFormDialog } from "@/components/productos/producto-form-dialog";
import { DeleteProductoButton } from "@/components/productos/delete-producto-button";
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
} from "@/app/admin/productos/actions";
import type { CategoriaProducto, Prisma } from "@/generated/prisma/client";

const CATEGORIAS = ["Plantilla", "Sistema", "Otro"];

const CATEGORIA_COLOR: Record<string, string> = {
  Plantilla: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Sistema: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  Otro: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};
const CATEGORIA_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Plantilla: FileText,
  Sistema: Code2,
  Otro: Package,
};
const ACTIVO_COLOR = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
const INACTIVO_COLOR = "bg-slate-500/15 text-slate-700 dark:text-slate-300";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; activo?: string }>;
}) {
  const { categoria, activo } = await searchParams;

  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Productos");
  if (!permisos.puedeVer) redirect("/admin");

  const where: Prisma.ProductoWhereInput = {};
  if (categoria) where.categoria = categoria as CategoriaProducto;
  if (activo) where.activo = activo === "true";

  const hasFiltros = Boolean(categoria || activo);

  const productos = await prisma.producto.findMany({
    where,
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            {productos.length} producto{productos.length === 1 ? "" : "s"}
            {hasFiltros
              ? " con estos filtros"
              : " registrado" + (productos.length === 1 ? "" : "s")}
          </p>
        </div>
        {permisos.puedeCrear && (
          <ProductoFormDialog title="Nuevo producto" action={crearProducto} submitLabel="Crear producto" />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select name="categoria" defaultValue={categoria ?? ""} className={selectClass}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select name="activo" defaultValue={activo ?? ""} className={selectClass}>
              <option value="">Todos los status</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFiltros && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/admin/productos">Limpiar</Link>
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
          {productos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasFiltros ? "No hay productos con esos filtros." : "Aún no hay productos registrados."}
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell>{p.categoria}</TableCell>
                      <TableCell>
                        <Badge variant={p.activo ? "secondary" : "outline"}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.requiereCotizacion ? "A cotizar" : formatCurrency(p.precio)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {permisos.puedeEditar && (
                            <ProductoFormDialog
                              trigger={
                                <Button size="icon" variant="ghost" className="size-7">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              title="Editar producto"
                              action={actualizarProducto.bind(null, p.id)}
                              defaultValues={{
                                nombre: p.nombre,
                                descripcion: p.descripcion,
                                categoria: p.categoria,
                                precio: Number(p.precio),
                                costoReferencia: p.costoReferencia ? Number(p.costoReferencia) : null,
                                requiereCotizacion: p.requiereCotizacion,
                                activo: p.activo,
                              }}
                              submitLabel="Guardar cambios"
                            />
                          )}
                          {permisos.puedeEditar && (
                            <DeleteProductoButton action={eliminarProducto.bind(null, p.id)} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {productos.map((p) => {
                  const Icono = CATEGORIA_ICON[p.categoria] ?? Package;
                  return (
                    <MobileRecordCard
                      key={p.id}
                      avatarLabel={<Icono className="size-5" />}
                      avatarClassName={CATEGORIA_COLOR[p.categoria]}
                      title={p.nombre}
                      subtitle={p.categoria}
                      meta={p.requiereCotizacion ? "A cotizar" : formatCurrency(p.precio)}
                      badge={
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            p.activo ? ACTIVO_COLOR : INACTIVO_COLOR
                          }`}
                        >
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                      }
                      actions={
                        <>
                          {permisos.puedeEditar && (
                            <ProductoFormDialog
                              trigger={
                                <Button size="icon" variant="ghost" className="size-7">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              title="Editar producto"
                              action={actualizarProducto.bind(null, p.id)}
                              defaultValues={{
                                nombre: p.nombre,
                                descripcion: p.descripcion,
                                categoria: p.categoria,
                                precio: Number(p.precio),
                                costoReferencia: p.costoReferencia ? Number(p.costoReferencia) : null,
                                requiereCotizacion: p.requiereCotizacion,
                                activo: p.activo,
                              }}
                              submitLabel="Guardar cambios"
                            />
                          )}
                          {permisos.puedeEditar && (
                            <DeleteProductoButton action={eliminarProducto.bind(null, p.id)} />
                          )}
                        </>
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
