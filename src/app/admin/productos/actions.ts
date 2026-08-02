"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma, type CategoriaProducto } from "@/generated/prisma/client";

export type ProductoFormState = { error?: string } | undefined;

function parseProductoForm(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "Plantilla") as CategoriaProducto;
  const precioRaw = String(formData.get("precio") ?? "");
  const costoReferenciaRaw = String(formData.get("costoReferencia") ?? "");
  const requiereCotizacion = formData.get("requiereCotizacion") === "on";
  const activo = formData.get("activo") === "on";

  return {
    nombre,
    descripcion,
    categoria,
    precioRaw,
    costoReferenciaRaw,
    requiereCotizacion,
    activo,
  };
}

function validateProductoForm(data: ReturnType<typeof parseProductoForm>) {
  if (!data.nombre) return "El nombre es obligatorio.";
  if (!data.precioRaw || Number.isNaN(Number(data.precioRaw)) || Number(data.precioRaw) <= 0) {
    return "El precio debe ser un número mayor a cero.";
  }
  if (
    data.costoReferenciaRaw &&
    (Number.isNaN(Number(data.costoReferenciaRaw)) || Number(data.costoReferenciaRaw) < 0)
  ) {
    return "El costo de referencia debe ser un número válido.";
  }
  return null;
}

export async function crearProducto(
  _prevState: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  const data = parseProductoForm(formData);
  const error = validateProductoForm(data);
  if (error) return { error };

  await prisma.producto.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      categoria: data.categoria,
      precio: data.precioRaw,
      costoReferencia: data.costoReferenciaRaw || null,
      requiereCotizacion: data.requiereCotizacion,
      activo: data.activo,
    },
  });

  revalidatePath("/admin/productos");
  revalidatePath("/admin/ventas");
  return undefined;
}

export async function actualizarProducto(
  id: number,
  _prevState: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  const data = parseProductoForm(formData);
  const error = validateProductoForm(data);
  if (error) return { error };

  try {
    await prisma.producto.update({
      where: { id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        categoria: data.categoria,
        precio: data.precioRaw,
        costoReferencia: data.costoReferenciaRaw || null,
        requiereCotizacion: data.requiereCotizacion,
        activo: data.activo,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "Este producto ya no existe." };
    }
    throw e;
  }

  revalidatePath("/admin/productos");
  revalidatePath("/admin/ventas");
  return undefined;
}

export async function eliminarProducto(id: number) {
  const ventas = await prisma.detalleVenta.count({ where: { productoId: id } });
  if (ventas > 0) return;

  await prisma.producto.delete({ where: { id } });
  revalidatePath("/admin/productos");
}
