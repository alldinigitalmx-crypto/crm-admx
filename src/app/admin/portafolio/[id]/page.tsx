import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { ImagenForm } from "@/components/portafolio/imagen-form";
import { subirImagenProyecto, eliminarImagenProyecto } from "@/app/admin/portafolio/actions";

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Portafolio");
  if (!permisos.puedeVer) redirect("/admin");

  const { id: idParam } = await params;
  const id = Number(idParam);

  const proyecto = await prisma.proyectoPortafolio.findUnique({ where: { id } });
  if (!proyecto) notFound();

  const imagenes = await prisma.archivo.findMany({
    where: { entidadTipo: "Proyecto", entidadId: id },
    orderBy: { creadoEn: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/portafolio"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Portafolio
        </Link>
        <h1 className="text-2xl font-semibold">{proyecto.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          Las imágenes de aquí son el carrusel que se ve al hacer clic en este proyecto en la
          página pública — el orden en que las subes es el orden en que aparecen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Imágenes ({imagenes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {permisos.puedeEditar && (
            <ImagenForm proyectoId={id} action={subirImagenProyecto.bind(null, id)} />
          )}

          {imagenes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no subes ninguna imagen de este proyecto.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {imagenes.map((img) => (
                <div key={img.id} className="flex flex-col gap-2 rounded-lg border border-input p-2">
                  <ZoomableImage
                    src={img.url}
                    alt={img.nombre}
                    className="h-40 w-full rounded-md object-cover"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{img.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(img.creadoEn)}</p>
                    </div>
                    {permisos.puedeEditar && (
                      <form action={eliminarImagenProyecto.bind(null, img.id, id)}>
                        <Button type="submit" size="icon" variant="ghost" className="size-6 shrink-0">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
