import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { TareaKanban } from "@/components/tareas/tarea-kanban";
import { TareasResumen } from "@/components/tareas/tareas-resumen";
import { calcularResumenTareas } from "@/lib/tareas-resumen";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import type { Prisma } from "@/generated/prisma/client";

export default async function TareasPage() {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Tareas");
  if (!permisos.puedeVer) redirect("/admin");

  const tareaWhere: Prisma.TareaWhereInput =
    !permisos.verTodo && usuario ? { asignadoAId: usuario.id } : {};

  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  // El tablero de todos los días no debe cargar CADA tarea completada
  // desde que existe la cuenta -- eso es justo lo que lo hacía cada vez
  // más lento y la columna de "Completadas" un scroll infinito de cosas
  // de hace meses. Solo se traen las completadas de los últimos 14 días;
  // el resto vive en /admin/tareas/historial (nada se borra).
  const hace14Dias = new Date();
  hace14Dias.setDate(hace14Dias.getDate() - 14);

  const [servicios, cotizaciones, prospectos, usuarios, tareas, completadasAntiguasCount, completadasRecientes] =
    await Promise.all([
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
    prisma.cliente.findMany({
      where: { etiqueta: "Prospecto" },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tarea.findMany({
      where: {
        ...tareaWhere,
        OR: [{ completada: false }, { completada: true, completadaEn: { gte: hace14Dias } }],
      },
      orderBy: [{ completada: "asc" }, { fechaLimite: "asc" }, { creadoEn: "desc" }],
      include: {
        servicio: { select: { descripcion: true } },
        cotizacion: {
          select: { cliente: { select: { nombre: true } }, prospectoNombre: true },
        },
        cliente: { select: { nombre: true } },
        subtareas: { orderBy: { creadoEn: "asc" } },
      },
    }),
    prisma.tarea.count({
      where: { ...tareaWhere, completada: true, completadaEn: { lt: hace14Dias } },
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
      label: `Negociación: ${nombreClienteCotizacion(c)}`,
    })),
    ...prospectos.map((p) => ({ value: `cliente:${p.id}`, label: `Prospecto: ${p.nombre}` })),
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
          {completadas.length} completada{completadas.length === 1 ? "" : "s"} en los últimos 14
          días
        </p>
      </div>

      <TareasResumen resumen={resumen} />

      <TareaKanban
        tareasPendientes={pendientes}
        tareasCompletadas={completadas}
        completadasAntiguasCount={completadasAntiguasCount}
        puedeEditar={permisos.puedeEditar}
        puedeCrear={permisos.puedeCrear}
        vinculos={vinculos}
        usuarios={usuarios}
        usuarioActualId={usuario?.id}
      />
    </div>
  );
}
