import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { TareasPanel } from "@/components/tareas/tareas-panel";
import {
  calcularResumenTareas,
  agruparTareasCompletadasPorPeriodo,
  calcularCompletadasPorPeriodosFijos,
} from "@/lib/tareas-resumen";
import { grupoDeTarea } from "@/lib/tareas-grupos";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { nombreClienteCotizacion } from "@/lib/cotizacion";
import { hoyEnMexico } from "@/lib/fecha";
import { construirRangoFecha, rangoEfectivo } from "@/lib/reportes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TareasChart } from "@/components/tareas/tareas-chart";
import type { Prisma } from "@/generated/prisma/client";

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const fechaTituloFormatter = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  timeZone: "UTC",
});

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

  // La lista de pendientes agrupada por urgencia no tiene límite de fecha
  // -- si no, una tarea vencida hace meses (justo la que más urge mostrar)
  // se perdería. Solo las completadas se acotan (ver hace30Dias) para que
  // esto no crezca para siempre; el resto vive en /admin/tareas/historial.
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const hoy = hoyEnMexico();
  const inicioAno = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));

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
    pendientes,
    completadas30Dias,
    completadasEnRango,
    completadasEsteAno,
    completadasTotalCount,
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
      where: { ...tareaWhere, completada: false },
      orderBy: [{ fechaLimite: "asc" }, { creadoEn: "desc" }],
      include: {
        servicio: { select: { descripcion: true } },
        cotizacion: {
          select: { cliente: { select: { nombre: true } }, prospectoNombre: true },
        },
        cliente: { select: { nombre: true } },
        subtareas: { orderBy: { creadoEn: "asc" } },
      },
    }),
    // Últimos 30 días -- alcanza tanto para la racha (calcularResumenTareas)
    // como para las barras de "cerradas por día" (últimos 14).
    prisma.tarea.findMany({
      where: { ...tareaWhere, completada: true, completadaEn: { gte: hace30Dias } },
      select: { id: true, titulo: true, completadaEn: true },
      orderBy: { completadaEn: "desc" },
    }),
    // Para el gráfico grande con filtro de abajo -- independiente de las
    // últimas cerradas/barras del panel.
    prisma.tarea.findMany({
      where: whereCompletadasRango,
      select: { completadaEn: true },
    }),
    // Para las cuentas fijas (hoy/7 días/30 días/mes/año) que siempre se
    // ven sin importar el filtro personalizado de arriba.
    prisma.tarea.findMany({
      where: { ...tareaWhere, completada: true, completadaEn: { gte: inicioAno } },
      select: { completadaEn: true },
    }),
    prisma.tarea.count({ where: { ...tareaWhere, completada: true } }),
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

  const resumen = calcularResumenTareas(
    pendientes,
    completadas30Dias.map((t) => t.completadaEn!)
  );

  const countVencidas = pendientes.filter((t) => grupoDeTarea(t.fechaLimite, hoy) === "vencidas").length;
  const masViejaVencida = pendientes
    .filter((t) => grupoDeTarea(t.fechaLimite, hoy) === "vencidas")
    .reduce<Date | null>((min, t) => (!min || t.fechaLimite! < min ? t.fechaLimite! : min), null);
  const diasVencida = masViejaVencida
    ? Math.round((hoy.getTime() - masViejaVencida.getTime()) / 86_400_000)
    : 0;

  const vinculoCounts = pendientes.reduce(
    (acc, t) => {
      if (t.servicioId) acc.servicios++;
      else if (t.cotizacionId) acc.negociaciones++;
      else if (t.clienteId) acc.prospectos++;
      else acc.sueltas++;
      return acc;
    },
    { servicios: 0, negociaciones: 0, prospectos: 0, sueltas: 0 }
  );

  const ultimasCerradas = completadas30Dias
    .slice(0, 5)
    .map((t) => ({ id: t.id, titulo: t.titulo, completadaEn: t.completadaEn! }));

  const hace13Dias = new Date(hoy);
  hace13Dias.setUTCDate(hace13Dias.getUTCDate() - 13);
  const { puntos: puntosBarras } = agruparTareasCompletadasPorPeriodo(
    completadas30Dias.map((t) => t.completadaEn!),
    hace13Dias,
    hoy
  );
  const barrasCerradas = puntosBarras.map((p) => ({ label: p.label, completadas: p.completadas }));

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
  const fijos = calcularCompletadasPorPeriodosFijos(
    completadasEsteAno.map((t) => t.completadaEn!),
    hoy
  );

  const hoyIso = isoDate(hoy);
  const hace7 = new Date(hoy);
  hace7.setUTCDate(hace7.getUTCDate() - 6);
  const hace30 = new Date(hoy);
  hace30.setUTCDate(hace30.getUTCDate() - 29);
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));

  const presetsBase = [
    { label: "Hoy", desde: hoyIso, hasta: hoyIso, todo: false, count: fijos.hoy },
    { label: "7 días", desde: isoDate(hace7), hasta: hoyIso, todo: false, count: fijos.dias7 },
    { label: "30 días", desde: isoDate(hace30), hasta: hoyIso, todo: false, count: fijos.dias30 },
    { label: "Este mes", desde: isoDate(inicioMes), hasta: hoyIso, todo: false, count: fijos.mes },
    { label: "Este año", desde: isoDate(inicioAno), hasta: hoyIso, todo: false, count: fijos.ano },
    { label: "Todo", desde: undefined, hasta: undefined, todo: true, count: completadasTotalCount },
  ] as const;
  const presetActivo =
    todo === "1"
      ? presetsBase[5].label
      : (presetsBase.find((p) => !p.todo && p.desde === desde && p.hasta === hasta)?.label ?? null);

  const presets = presetsBase.map((p) => {
    const params = new URLSearchParams();
    if (p.todo) params.set("todo", "1");
    else {
      if (p.desde) params.set("desde", p.desde);
      if (p.hasta) params.set("hasta", p.hasta);
    }
    return {
      label: p.label,
      count: p.count,
      href: `/admin/tareas?${params}`,
      activo: presetActivo === p.label,
    };
  });

  const totalHoy = resumen.completadasHoy + pendientes.filter((t) => grupoDeTarea(t.fechaLimite, hoy) === "hoy" || grupoDeTarea(t.fechaLimite, hoy) === "vencidas").length;
  const progresoHoyPct = totalHoy > 0 ? Math.round((resumen.completadasHoy / totalHoy) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:gap-9">
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] font-medium tracking-wider text-primary uppercase">Tareas</span>
            <h1 className="text-[26px] leading-tight font-semibold capitalize">
              {fechaTituloFormatter.format(hoy)}
            </h1>
          </div>

          <div className="flex flex-wrap gap-7">
            <div className="flex min-w-[120px] flex-col gap-1.5">
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Hoy</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tabular-nums">{resumen.completadasHoy}</span>
                <span className="text-xs text-muted-foreground">/ {totalHoy} cerradas</span>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progresoHoyPct}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-l border-border pl-7">
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Racha</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tabular-nums">{resumen.racha}</span>
                <span className="text-xs text-muted-foreground">{resumen.racha === 1 ? "día seguido" : "días seguidos"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-l border-border pl-7">
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Atención</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tabular-nums text-destructive">{countVencidas}</span>
                <span className="text-xs text-muted-foreground">vencidas</span>
              </div>
              {diasVencida > 0 && (
                <span className="text-[11px] text-muted-foreground">La más vieja: hace {diasVencida} d</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <TareasPanel
        tareasPendientes={pendientes}
        puedeEditar={permisos.puedeEditar}
        puedeCrear={permisos.puedeCrear}
        vinculos={vinculos}
        usuarios={usuarios}
        usuarioActualId={usuario?.id}
        hoy={hoy}
        vinculoCounts={vinculoCounts}
        ultimasCerradas={ultimasCerradas}
        barrasCerradas={barrasCerradas}
        presets={presets}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Tareas completadas — {totalCompletadasRango}
          </CardTitle>
          <CardDescription className="text-xs">
            {granularidad === "mes" ? "Un punto por mes." : "Un punto por día."} Ajusta el rango con el
            filtro de abajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <TareasChart datos={puntosTareas} />

          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="desde" className="text-xs text-muted-foreground">
                Desde
              </label>
              <Input id="desde" type="date" name="desde" defaultValue={desde ?? ""} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="hasta" className="text-xs text-muted-foreground">
                Hasta
              </label>
              <Input id="hasta" type="date" name="hasta" defaultValue={hasta ?? ""} />
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/tareas?todo=1">Ver todo</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
