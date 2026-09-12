import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Minus, Activity, CalendarClock } from "lucide-react";

import { requiereAdmin } from "@/lib/alcance";
import { prisma } from "@/lib/prisma";
import { hoyEnMexico } from "@/lib/fecha";
import { montoNetoEnMXN } from "@/lib/pago-monto";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  minimosCuadrados,
  proyectar,
  agruparRecaudadoMensual,
  mesSiguiente,
} from "@/lib/regresion";
import { ProyeccionChart, type PuntoProyeccion } from "@/components/proyeccion/proyeccion-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const HORIZONTE_MESES = 3;

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default async function ProyeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; todo?: string }>;
}) {
  if (!(await requiereAdmin())) redirect("/admin");

  const { desde: desdeParam, hasta: hastaParam, todo } = await searchParams;
  const usaTodo = todo === "1" || (!desdeParam && !hastaParam);

  const hoy = hoyEnMexico();
  const hoyIso = isoDate(hoy);
  const inicioMesActual = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));

  const [minPago] = await Promise.all([prisma.pago.aggregate({ _min: { fecha: true } })]);
  const primerPago = minPago._min.fecha;
  const primerPagoMes = primerPago
    ? new Date(Date.UTC(primerPago.getUTCFullYear(), primerPago.getUTCMonth(), 1))
    : inicioMesActual;

  // Rango efectivo: "Todo" usa desde el primer pago; un rango personalizado
  // (desde/hasta en la URL, vengan de un preset o del formulario) usa
  // exactamente lo que se pidió -- "hasta" puede quedar en el pasado si se
  // quiere ver la tendencia de un tramo ya cerrado, no solo hasta hoy.
  const desde = usaTodo
    ? primerPagoMes
    : desdeParam
      ? new Date(`${desdeParam}T00:00:00`)
      : primerPagoMes;
  const hasta = usaTodo
    ? inicioMesActual
    : hastaParam
      ? new Date(`${hastaParam}T00:00:00`)
      : inicioMesActual;

  const pagos = await prisma.pago.findMany({
    where: { confirmado: true, fecha: { gte: desde, lte: new Date(hasta.getTime() + 31 * 86_400_000) } },
    select: { fecha: true, monto: true, moneda: true, montoMXN: true, comision: true, montoIncluyeComision: true },
  });

  const puntosMensuales = agruparRecaudadoMensual(
    pagos.map((p) => ({ fecha: p.fecha, monto: montoNetoEnMXN(p) })),
    desde,
    hasta
  );

  const regresion = minimosCuadrados(puntosMensuales.map((p, i) => ({ x: i, y: p.recaudado })));

  const ultimo = puntosMensuales[puntosMensuales.length - 1] ?? { anio: hasta.getUTCFullYear(), mes: hasta.getUTCMonth() };
  const proyeccionMeses: PuntoProyeccion[] = [
    ...puntosMensuales.map((p, i) => ({
      key: p.key,
      label: p.label,
      recaudado: p.recaudado,
      tendencia: proyectar(regresion, i),
    })),
    ...Array.from({ length: HORIZONTE_MESES }, (_, i) => {
      const n = i + 1;
      const { label } = mesSiguiente(ultimo.anio, ultimo.mes, n);
      const x = puntosMensuales.length - 1 + n;
      return { key: `proj-${n}`, label, recaudado: null, tendencia: proyectar(regresion, x) };
    }),
  ];

  const promedioMensual =
    puntosMensuales.length > 0 ? puntosMensuales.reduce((acc, p) => acc + p.recaudado, 0) / puntosMensuales.length : 0;
  // Umbral: si el cambio mensual es menor al 2% del promedio, se lee
  // como "estable" en vez de forzar una dirección con ruido.
  const umbralEstable = Math.abs(promedioMensual) * 0.02;
  const direccion: "up" | "down" | "flat" =
    Math.abs(regresion.pendiente) < umbralEstable ? "flat" : regresion.pendiente > 0 ? "up" : "down";
  const IconoDireccion = direccion === "up" ? TrendingUp : direccion === "down" ? TrendingDown : Minus;
  const colorDireccion =
    direccion === "up" ? "text-success bg-success/10" : direccion === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground bg-muted";

  const proximoMes = mesSiguiente(ultimo.anio, ultimo.mes, 1);
  const proyeccionProximoMes = proyectar(regresion, puntosMensuales.length);

  const confiable = regresion.r2 >= 0.3 && regresion.n >= 3;

  const hace6 = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 5, 1));
  const hace12 = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 11, 1));
  const hace24 = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 23, 1));
  const inicioAno = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));

  const presets = [
    { label: "Este año", desde: isoDate(inicioAno), hasta: hoyIso, todo: false },
    { label: "Últimos 6 meses", desde: isoDate(hace6), hasta: hoyIso, todo: false },
    { label: "Últimos 12 meses", desde: isoDate(hace12), hasta: hoyIso, todo: false },
    { label: "Últimos 2 años", desde: isoDate(hace24), hasta: hoyIso, todo: false },
    { label: "Todo el histórico", desde: undefined, hasta: undefined, todo: true },
  ];
  const presetActivo = usaTodo
    ? presets[4]
    : (presets.find((p) => !p.todo && p.desde === desdeParam && p.hasta === hastaParam) ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Proyección</h1>
        <p className="text-sm text-muted-foreground">
          Tendencia del recaudado neto mes a mes, calculada por mínimos cuadrados — para ver hacia dónde va el
          negocio, no solo dónde está hoy.
        </p>
        <p className="text-xs text-muted-foreground">
          Base: {formatDate(desde)} — {formatDate(hasta)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Base de cálculo</CardTitle>
          <CardDescription className="text-xs">
            Sobre qué meses se ajusta la recta — el histórico completo suaviza más, pero un tramo reciente
            refleja mejor cómo va el negocio ahora mismo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const params = new URLSearchParams();
              if (p.todo) params.set("todo", "1");
              else {
                if (p.desde) params.set("desde", p.desde);
                if (p.hasta) params.set("hasta", p.hasta);
              }
              const activo = presetActivo?.label === p.label;
              return (
                <Button key={p.label} asChild size="sm" variant={activo ? "default" : "outline"}>
                  <Link href={`/admin/proyeccion?${params}`}>{p.label}</Link>
                </Button>
              );
            })}
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="desde" className="text-xs text-muted-foreground">
                Desde
              </label>
              <Input id="desde" type="date" name="desde" defaultValue={desdeParam ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="hasta" className="text-xs text-muted-foreground">
                Hasta
              </label>
              <Input id="hasta" type="date" name="hasta" defaultValue={hastaParam ?? ""} />
            </div>
            <Button type="submit" className="self-end">
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>

      {puntosMensuales.length < 3 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Hace falta al menos 3 meses con pagos confirmados para calcular una tendencia confiable.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-start gap-3 py-4">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${colorDireccion}`}>
                  <IconoDireccion className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Tendencia mensual</p>
                  <p className="text-2xl font-semibold">
                    {regresion.pendiente >= 0 ? "+" : ""}
                    {formatCurrency(regresion.pendiente)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {direccion === "up" && "el recaudado sube cada mes, en promedio"}
                    {direccion === "down" && "el recaudado baja cada mes, en promedio"}
                    {direccion === "flat" && "sin cambio claro mes a mes"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarClock className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Proyección — {proximoMes.label}</p>
                  <p className="text-2xl font-semibold">{formatCurrency(Math.max(0, proyeccionProximoMes))}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Si la tendencia actual se mantiene</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start gap-3 py-4">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    confiable ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <Activity className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Ajuste del modelo (R²)</p>
                  <p className="text-2xl font-semibold">{(regresion.r2 * 100).toFixed(0)}%</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {confiable
                      ? "la recta explica bien el histórico"
                      : "muy irregular — toma la proyección con cautela"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recaudado mensual y tendencia</CardTitle>
              <CardDescription className="text-xs">
                {puntosMensuales.length} meses con datos, proyectados {HORIZONTE_MESES} meses hacia adelante. La
                zona sombreada es proyección, no dato real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProyeccionChart datos={proyeccionMeses} primerIndiceProyeccion={puntosMensuales.length - 1} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">¿Qué es esto?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Mínimos cuadrados</span> es el método clásico para
                trazar la recta que mejor resume una serie de datos con ruido — aquí, tu recaudado neto de cada
                mes. En vez de mirar mes por mes, la recta dice si el negocio está creciendo, estancado o
                cayendo en promedio, y por cuánto.
              </p>
              <p>
                <span className="font-medium text-foreground">R²</span> mide qué tan bien la recta describe lo
                que de verdad pasó (100% = ajuste perfecto, 0% = los meses no siguen ningún patrón). Con pocos
                meses o mucha variación entre uno y otro, un R² bajo es normal — no significa que el cálculo
                esté mal, sino que hay que tomar la proyección con más cautela.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
