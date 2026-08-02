import Link from "next/link";
import { Pencil } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
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
import { ProductoFormDialog } from "@/components/productos/producto-form-dialog";
import { DeleteProductoButton } from "@/components/productos/delete-producto-button";
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
} from "@/app/admin/productos/actions";
import type { CategoriaProducto, Prisma } from "@/generated/prisma/client";

const CATEGORIAS = ["Plantilla", "Sistema", "Otro"];

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; activo?: string }>;
}) {
  const { categoria, activo } = await searchParams;

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
        <ProductoFormDialog title="Nuevo producto" action={crearProducto} submitLabel="Crear producto" />
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
            <Table>
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
                        <DeleteProductoButton action={eliminarProducto.bind(null, p.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
