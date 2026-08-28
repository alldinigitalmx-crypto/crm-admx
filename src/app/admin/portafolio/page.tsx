import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProyectoFormDialog } from "@/components/portafolio/proyecto-form-dialog";
import {
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  moverProyecto,
} from "@/app/admin/portafolio/actions";

export default async function PortafolioPage() {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Portafolio");
  if (!permisos.puedeVer) redirect("/admin");

  const proyectos = await prisma.proyectoPortafolio.findMany({
    orderBy: { orden: "asc" },
  });

  const conteoImagenes = await prisma.archivo.groupBy({
    by: ["entidadId"],
    where: { entidadTipo: "Proyecto", entidadId: { in: proyectos.map((p) => p.id) } },
    _count: true,
  });
  const conteoPorProyecto = new Map(conteoImagenes.map((c) => [c.entidadId, c._count]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Portafolio</h1>
          <p className="text-sm text-muted-foreground">
            Casos de éxito que se muestran en la sección &quot;Nuestro trabajo&quot; de la
            página pública — {proyectos.length} proyecto{proyectos.length === 1 ? "" : "s"}
          </p>
        </div>
        {permisos.puedeCrear && (
          <ProyectoFormDialog
            trigger={
              <Button>
                <Plus />
                Nuevo proyecto
              </Button>
            }
            title="Nuevo proyecto"
            action={crearProyecto}
            submitLabel="Crear proyecto"
          />
        )}
      </div>

      {proyectos.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aún no hay proyectos en el portafolio.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((p, i) => (
            <Card key={p.id} className={p.activo ? undefined : "opacity-60"}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {p.destacado && <Star className="size-3.5 shrink-0 fill-current text-gold" />}
                      <p className="truncate font-medium">{p.titulo}</p>
                    </div>
                    {p.categoria && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {p.categoria}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col">
                    {permisos.puedeEditar && (
                      <>
                        <form action={moverProyecto.bind(null, p.id, "arriba")}>
                          <Button type="submit" size="icon" variant="ghost" className="size-6" disabled={i === 0}>
                            <ArrowUp className="size-3.5" />
                          </Button>
                        </form>
                        <form action={moverProyecto.bind(null, p.id, "abajo")}>
                          <Button
                            type="submit"
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            disabled={i === proyectos.length - 1}
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </div>

                {p.descripcion && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.descripcion}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="size-3.5" />
                    {conteoPorProyecto.get(p.id) ?? 0} imagen
                    {(conteoPorProyecto.get(p.id) ?? 0) === 1 ? "" : "es"}
                  </span>
                  {!p.activo && <Badge variant="outline">Oculto</Badge>}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link href={`/admin/portafolio/${p.id}`}>
                      <ImageIcon />
                      Imágenes
                    </Link>
                  </Button>
                  {permisos.puedeEditar && (
                    <ProyectoFormDialog
                      trigger={
                        <Button size="icon" variant="outline">
                          <Pencil className="size-4" />
                        </Button>
                      }
                      title="Editar proyecto"
                      action={actualizarProyecto.bind(null, p.id)}
                      submitLabel="Guardar cambios"
                      defaultValues={{
                        titulo: p.titulo,
                        descripcion: p.descripcion,
                        categoria: p.categoria,
                        linkExterno: p.linkExterno,
                        destacado: p.destacado,
                        activo: p.activo,
                      }}
                    />
                  )}
                  {permisos.puedeEditar && (
                    <form action={eliminarProyecto.bind(null, p.id)}>
                      <Button
                        type="submit"
                        size="icon"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
