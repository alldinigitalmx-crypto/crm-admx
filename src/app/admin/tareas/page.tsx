import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { TareaKanban } from "@/components/tareas/tarea-kanban";
import { TareasResumen } from "@/components/tareas/tareas-resumen";
import { calcularResumenTareas } from "@/lib/tareas-resumen";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import type { Prisma } from "@/generated/prisma/client";

export default async function TareasPage() {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Tareas");
  if (!permisos.puedeVer) redirect("/admin");

  const tareaWhere: Prisma.TareaWhereInput =
    !permisos.verTodo && usuario ? { asignadoAId: usuario.id } : {};

  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const [servicios, cotizaciones, usuarios, tareas, completadasRecientes] = await Promise.all([
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
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tarea.findMany({
      where: tareaWhere,
      orderBy: [{ completada: "asc" }, { fechaLimite: "asc" }, { creadoEn: "desc" }],
      include: {
        servicio: { select: { descripcion: true } },
        cotizacion: { select: { cliente: { select: { nombre: true } } } },
      },
    }),
    prisma.tarea.findMany({
      where: { ...tareaWhere, completada: true, completadaEn: { gte: hace30Dias } },
      select: { completadaEn: true },
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

  const resumen = calcularResumenTareas(
    pendientes,
    completadasRecientes.map((t) => t.completadaEn!)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tareas</h1>
        <p className="text-sm text-muted-foreground">
          {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"} —{" "}
          {completadas.length} completada{completadas.length === 1 ? "" : "s"}
        </p>
      </div>

      <TareasResumen resumen={resumen} />

      <TareaKanban
        tareasPendientes={pendientes}
        tareasCompletadas={completadas}
        puedeEditar={permisos.puedeEditar}
        puedeCrear={permisos.puedeCrear}
        vinculos={vinculos}
        usuarios={usuarios}
        usuarioActualId={usuario?.id}
      />
    </div>
  );
}
