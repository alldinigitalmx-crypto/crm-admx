import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaLista } from "@/components/tareas/tarea-lista";
import { crearTarea } from "@/app/admin/tareas/actions";

export default async function TareasPage() {
  const [servicios, cotizaciones, tareas] = await Promise.all([
    prisma.servicio.findMany({
      where: { status: { notIn: ["Entregado", "Cancelado"] } },
      select: { id: true, descripcion: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.cotizacion.findMany({
      where: { servicioId: null, status: { in: ["Enviada", "Firmada"] } },
      include: { cliente: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.tarea.findMany({
      orderBy: [{ completada: "asc" }, { fechaLimite: "asc" }, { creadoEn: "desc" }],
      include: { servicio: true, cotizacion: { include: { cliente: true } } },
    }),
  ]);

  const vinculos = [
    ...servicios.map((s) => ({ value: `servicio:${s.id}`, label: `Servicio: ${s.descripcion}` })),
    ...cotizaciones.map((c) => ({
      value: `cotizacion:${c.id}`,
      label: `Negociación: ${c.cliente.nombre}`,
    })),
  ];

  const pendientes = tareas.filter((t) => !t.completada);
  const completadas = tareas.filter((t) => t.completada);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"} —{" "}
            {completadas.length} completada{completadas.length === 1 ? "" : "s"}
          </p>
        </div>
        <TareaFormDialog action={crearTarea} vinculos={vinculos} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Pendientes ({pendientes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <TareaLista
            tareas={pendientes}
            mostrarVinculo
            emptyText="No tienes tareas pendientes."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Completadas ({completadas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <TareaLista
            tareas={completadas}
            mostrarVinculo
            emptyText="Aún no completas ninguna tarea."
          />
        </CardContent>
      </Card>
    </div>
  );
}
