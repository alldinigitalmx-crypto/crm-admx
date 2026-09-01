import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { TareaKanban } from "@/components/tareas/tarea-kanban";
import { TareasResumen } from "@/components/tareas/tareas-resumen";
import { TareasChart } from "@/components/tareas/tareas-chart";
import { calcularResumenTareas, agruparTareasCompletadasPorPeriodo } from "@/lib/tareas-resumen";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import { hoyEnMexico } from "@/lib/fecha";
import { construirRangoFecha, rangoEfectivo } from "@/lib/reportes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Prisma } from "@/generated/prisma/client";

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; todo?: string }>;
}) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Tareas");
  if (!permisos.puedeVer) redirect("/admin");

  const { desde, hasta, todo } = await searchParams;

  // Mismo default y mismos presets que Reportes/KPIs: sin filtro en la
  // URL, "Este mes" de entrada -- así el gráfico de tareas se siente
  // parte de la misma familia en vez de una cosa aparte.
  if (!desde && !hasta && todo !== "1") {
    const hoyDefault = hoyEnMexico();
    const inicioMesDefault = new Date(Date.UTC(hoyDefault.getUTCFullYear(), hoyDefault.getUTCMonth(), 1));
    redirect(`/admin/tareas?desde=${isoDate(inicioMesDefault)}&hasta=${isoDate(hoyDefault)}`);
  }

  const tareaWhere: Prisma.TareaWhereInput =
    !permisos.verTodo && usuario ? { asignadoAId: usuario.id } : {};

  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  // El tablero de todos los días no debe cargar CADA tarea completada
  // desde que existe la cuenta -- eso es justo lo que lo hacía cada vez
  // más lento y la columna de "Completadas" un scroll infinito de cosas
  // de hace meses. Solo se traen las completadas de los últimos 14 días;
  // el resto vive en /admin/tareas/historial (nada se borra). Esto es
  // independiente del filtro de fechas del gráfico de abajo.
  const hace14Dias = new Date();
  hace14Dias.setDate(hace14Dias.getDate() - 14);

  const rango = construirRangoFecha(todo === "1" ? undefined : desde, todo === "1" ? undefined : hasta);
  const whereCompletadasRango: Prisma.TareaWhereInput = {
    ...tareaWhere,
    completada: true,
    ...(rango ? { completadaEn: rango } : { completadaEn: { not: null } }),
  };

  const [
    servicios,
    cotizaciones,
    prospectos,
    usuarios,
    tareas,
    completadasAntiguasCount,
    completadasRecientes,
    completadasEnRango,
    minTarea,
  ] = await Promise.all([
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
    // Para el gráfico con filtro de abajo -- independiente de las
    // "últimas 14 días" del tablero.
    prisma.tarea.findMany({
      where: whereCompletadasRango,
      select: { completadaEn: true },
    }),
    prisma.tarea.aggregate({ where: tareaWhere, _min: { creadoEn: true } }),
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

  const { desde: desdeEfectivo, hasta: hastaEfectivo } = rangoEfectivo(
    todo === "1" ? undefined : desde,
    todo === "1" ? undefined : hasta,
    minTarea._min.creadoEn
  );
  const { puntos: puntosTareas, granularidad } = agruparTareasCompletadasPorPeriodo(
    completadasEnRango.map((t) => t.completadaEn!),
    desdeEfectivo,
    hastaEfectivo
  );
  const totalCompletadasRango = completadasEnRango.length;

  const hoy = hoyEnMexico();
  const hoyIso = isoDate(hoy);
  const hace7 = new Date(hoy);
  hace7.setUTCDate(hace7.getUTCDate() - 6);
  const hace30 = new Date(hoy);
  hace30.setUTCDate(hace30.getUTCDate() - 29);
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const inicioAno = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));

  const presets = [
    { label: "Hoy", desde: hoyIso, hasta: hoyIso, todo: false },
    { label: "7 días", desde: isoDate(hace7), hasta: hoyIso, todo: false },
    { label: "30 días", desde: isoDate(hace30), hasta: hoyIso, todo: false },
    { label: "Este mes", desde: isoDate(inicioMes), hasta: hoyIso, todo: false },
    { label: "Este año", desde: isoDate(inicioAno), hasta: hoyIso, todo: false },
    { label: "Todo", desde: undefined, hasta: undefined, todo: true },
  ];
  const presetActivo =
    todo === "1" ? presets[5] : (presets.find((p) => !p.todo && p.desde === desde && p.hasta === hasta) ?? null);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Rango de fechas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const params = new URLSearchParams();
              if (p.todo) {
                params.set("todo", "1");
              } else {
                if (p.desde) params.set("desde", p.desde);
                if (p.hasta) params.set("hasta", p.hasta);
              }
              const href = `/admin/tareas?${params}`;
              const activo = presetActivo?.label === p.label;
              return (
                <Button key={p.label} asChild size="sm" variant={activo ? "default" : "outline"}>
                  <Link href={href}>{p.label}</Link>
                </Button>
              );
            })}
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="desde" className="text-xs text-muted-foreground">
                Desde
              </label>
              <Input id="desde" type="date" name="desde" defaultValue={desde ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="hasta" className="text-xs text-muted-foreground">
                Hasta
              </label>
              <Input id="hasta" type="date" name="hasta" defaultValue={hasta ?? ""} />
            </div>
            <Button type="submit" className="self-end">
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Tareas completadas ({totalCompletadasRango})
          </CardTitle>
          <CardDescription className="text-xs">
            {granularidad === "mes" ? "Un punto por mes." : "Un punto por día."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TareasChart datos={puntosTareas} />
        </CardContent>
      </Card>
    </div>
  );
}
