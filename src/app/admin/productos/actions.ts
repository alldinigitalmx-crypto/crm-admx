"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requiereNivel } from "@/lib/alcance";
import { currentUsuario } from "@/lib/current-usuario";
import { Prisma, type CategoriaProducto, type TipoEntregaProducto } from "@/generated/prisma/client";

export type ProductoFormState = { error?: string } | undefined;

function parseProductoForm(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "Plantilla") as CategoriaProducto;
  const precioRaw = String(formData.get("precio") ?? "");
  const costoReferenciaRaw = String(formData.get("costoReferencia") ?? "");
  const requiereCotizacion = formData.get("requiereCotizacion") === "on";
  const activo = formData.get("activo") === "on";
  const tipoEntrega = String(formData.get("tipoEntrega") ?? "ArchivoDescargable") as TipoEntregaProducto;
  const linkAppSheet = String(formData.get("linkAppSheet") ?? "").trim() || null;
  const linkTutorial = String(formData.get("linkTutorial") ?? "").trim() || null;
  const linkExterno = String(formData.get("linkExterno") ?? "").trim() || null;

  return {
    nombre,
    descripcion,
    categoria,
    precioRaw,
    costoReferenciaRaw,
    requiereCotizacion,
    activo,
    tipoEntrega,
    linkAppSheet,
    linkTutorial,
    linkExterno,
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
  if (data.tipoEntrega === "LinkAppSheet" && !data.linkAppSheet) {
    return "Captura el link de la plantilla de AppSheet.";
  }
  if (data.tipoEntrega === "LinkExterno" && !data.linkExterno) {
    return "Captura el link externo.";
  }
  return null;
}

// Imagen y archivo descargable viven en Archivo (entidadTipo: "Producto"),
// mismo patrón que el portafolio -- ya se subieron a Blob del lado del
// cliente antes de este submit, aquí solo se guarda el registro. Si el
// admin no tocó el input (url vacía) no se toca lo que ya había.
async function guardarArchivoProducto(
  productoId: number,
  tipo: "Imagen" | "Documento",
  formData: FormData,
  campoUrl: string,
  campoNombre: string,
  campoTamanio: string
) {
  const url = String(formData.get(campoUrl) ?? "").trim();
  if (!url) return;

  const nombre = String(formData.get(campoNombre) ?? "").trim() || "Archivo";
  const tamanioRaw = formData.get(campoTamanio);
  const tamanioBytes = tamanioRaw ? Number(tamanioRaw) : null;
  const usuario = await currentUsuario();

  await prisma.archivo.deleteMany({ where: { entidadTipo: "Producto", entidadId: productoId, tipo } });
  await prisma.archivo.create({
    data: {
      entidadTipo: "Producto",
      entidadId: productoId,
      nombre,
      url,
      tipo,
      tamanioBytes: tamanioBytes && Number.isFinite(tamanioBytes) ? tamanioBytes : null,
      subidoPorId: usuario?.id ?? null,
    },
  });
}

export async function crearProducto(
  _prevState: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  if (!(await requiereNivel("Productos", "Crear"))) {
    return { error: "No tienes permiso para crear en este módulo." };
  }

  const data = parseProductoForm(formData);
  const error = validateProductoForm(data);
  if (error) return { error };

  const producto = await prisma.producto.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      categoria: data.categoria,
      precio: data.precioRaw,
      costoReferencia: data.costoReferenciaRaw || null,
      requiereCotizacion: data.requiereCotizacion,
      activo: data.activo,
      tipoEntrega: data.tipoEntrega,
      linkAppSheet: data.linkAppSheet,
      linkTutorial: data.linkTutorial,
      linkExterno: data.linkExterno,
    },
  });

  await guardarArchivoProducto(producto.id, "Imagen", formData, "imagenUrl", "imagenNombre", "imagenTamanioBytes");
  await guardarArchivoProducto(producto.id, "Documento", formData, "archivoUrl", "archivoNombre", "archivoTamanioBytes");

  revalidatePath("/admin/productos");
  revalidatePath("/admin/ventas");
  return undefined;
}

export async function actualizarProducto(
  id: number,
  _prevState: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  if (!(await requiereNivel("Productos", "Editar"))) {
    return { error: "No tienes permiso para editar en este módulo." };
  }

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
        tipoEntrega: data.tipoEntrega,
        linkAppSheet: data.linkAppSheet,
        linkTutorial: data.linkTutorial,
        linkExterno: data.linkExterno,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { error: "Este producto ya no existe." };
    }
    throw e;
  }

  await guardarArchivoProducto(id, "Imagen", formData, "imagenUrl", "imagenNombre", "imagenTamanioBytes");
  await guardarArchivoProducto(id, "Documento", formData, "archivoUrl", "archivoNombre", "archivoTamanioBytes");

  revalidatePath("/admin/productos");
  revalidatePath("/admin/ventas");
  return undefined;
}

export async function eliminarProducto(id: number) {
  if (!(await requiereNivel("Productos", "Editar"))) return;

  const ventas = await prisma.detalleVenta.count({ where: { productoId: id } });
  if (ventas > 0) return;

  await prisma.archivo.deleteMany({ where: { entidadTipo: "Producto", entidadId: id } });
  await prisma.producto.delete({ where: { id } });
  revalidatePath("/admin/productos");
}
