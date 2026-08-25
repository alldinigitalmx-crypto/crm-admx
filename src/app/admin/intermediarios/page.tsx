import { redirect } from "next/navigation";
import { Plus, Pencil } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { IntermediarioFormDialog } from "@/components/intermediarios/intermediario-form-dialog";
import { DeleteIntermediarioButton } from "@/components/intermediarios/delete-intermediario-button";
import {
  actualizarIntermediario,
  crearIntermediario,
  eliminarIntermediario,
} from "@/app/admin/intermediarios/actions";

export default async function IntermediariosPage() {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Intermediarios");
  if (!permisos.puedeVer) redirect("/admin");

  const intermediarios = await prisma.intermediario.findMany({ orderBy: { nombre: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Intermediarios</h1>
          <p className="text-sm text-muted-foreground">
            {intermediarios.length} intermediario{intermediarios.length === 1 ? "" : "s"} registrado
            {intermediarios.length === 1 ? "" : "s"}
          </p>
        </div>
        {permisos.puedeCrear && (
          <IntermediarioFormDialog
            trigger={
              <Button>
                <Plus />
                Nuevo intermediario
              </Button>
            }
            title="Nuevo intermediario"
            action={crearIntermediario}
            submitLabel="Crear intermediario"
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {intermediarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay intermediarios registrados.
            </p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Notas</TableHead>
                    {permisos.puedeEditar && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intermediarios.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {i.nombre.trim().charAt(0).toUpperCase() || "?"}
                          </span>
                          {i.nombre}
                        </div>
                      </TableCell>
                      <TableCell>{i.telefono ?? "—"}</TableCell>
                      <TableCell>{i.email ?? "—"}</TableCell>
                      <TableCell className="max-w-64 truncate">{i.notas ?? "—"}</TableCell>
                      {permisos.puedeEditar && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <IntermediarioFormDialog
                              trigger={
                                <Button size="icon" variant="ghost" className="size-7">
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              title="Editar intermediario"
                              action={actualizarIntermediario.bind(null, i.id)}
                              defaultValues={{
                                nombre: i.nombre,
                                telefono: i.telefono,
                                email: i.email,
                                notas: i.notas,
                              }}
                              submitLabel="Guardar cambios"
                            />
                            <DeleteIntermediarioButton
                              action={eliminarIntermediario.bind(null, i.id)}
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {intermediarios.map((i) => (
                  <MobileRecordCard
                    key={i.id}
                    avatarLabel={i.nombre.trim().charAt(0).toUpperCase() || "?"}
                    title={i.nombre}
                    subtitle={i.telefono ?? i.email ?? undefined}
                    meta={i.telefono && i.email ? i.email : (i.notas ?? undefined)}
                    actions={
                      permisos.puedeEditar ? (
                        <>
                          <IntermediarioFormDialog
                            trigger={
                              <Button size="icon" variant="ghost" className="size-7">
                                <Pencil className="size-4" />
                              </Button>
                            }
                            title="Editar intermediario"
                            action={actualizarIntermediario.bind(null, i.id)}
                            defaultValues={{
                              nombre: i.nombre,
                              telefono: i.telefono,
                              email: i.email,
                              notas: i.notas,
                            }}
                            submitLabel="Guardar cambios"
                          />
                          <DeleteIntermediarioButton
                            action={eliminarIntermediario.bind(null, i.id)}
                          />
                        </>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
