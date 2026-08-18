import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ResumenTareas } from "@/lib/tareas-resumen";

const PRIORIDAD_LABEL: Record<string, string> = {
  Alta: "Alta prioridad",
  Media: "Prioridad media",
  Baja: "Prioridad baja",
};

const PRIORIDAD_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Alta: "destructive",
  Media: "secondary",
  Baja: "outline",
};

function Sparkline({ tendencia7 }: { tendencia7: ResumenTareas["tendencia7"] }) {
  const max = Math.max(1, ...tendencia7.map((d) => d.completadas));
  const w = 120;
  const h = 32;
  const step = w / (tendencia7.length - 1 || 1);

  const points = tendencia7
    .map((d, i) => {
      const x = i * step;
      const y = h - (d.completadas / max) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full max-w-[140px] overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-600 dark:text-blue-400"
      />
      {tendencia7.map((d, i) => {
        const x = i * step;
        const y = h - (d.completadas / max) * (h - 4) - 2;
        return (
          <circle
            key={d.fecha}
            cx={x}
            cy={y}
            r={i === tendencia7.length - 1 ? 2.5 : 1.5}
            className="fill-blue-600 dark:fill-blue-400"
          />
        );
      })}
    </svg>
  );
}

export function TareasResumen({ resumen }: { resumen: ResumenTareas }) {
  const { pendientesCount, completadasHoy, progresoPct, racha, tendencia7, proximaPrioridad } =
    resumen;
  const totalHoy = pendientesCount + completadasHoy;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex flex-col gap-1 py-2">
          <p className="text-xs text-muted-foreground">Progreso de hoy</p>
          <p className="text-2xl font-semibold">
            {completadasHoy} <span className="text-base font-normal text-muted-foreground">de {totalHoy}</span>
          </p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500 dark:bg-blue-500"
              style={{ width: `${progresoPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 py-2">
          <p className="text-xs text-muted-foreground">Racha</p>
          <p className="text-2xl font-semibold">
            {racha > 0 ? `🔥 ${racha}` : "—"}{" "}
            <span className="text-base font-normal text-muted-foreground">
              {racha === 1 ? "día" : "días"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {racha > 0 ? "¡Sigue así!" : "Completa una tarea para empezar tu racha"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 py-2">
          <p className="text-xs text-muted-foreground">Próxima prioridad</p>
          {proximaPrioridad ? (
            <Badge variant={PRIORIDAD_VARIANT[proximaPrioridad]} className="w-fit text-sm">
              {PRIORIDAD_LABEL[proximaPrioridad]}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes 🎉</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1 py-2">
          <p className="text-xs text-muted-foreground">Últimos 7 días</p>
          <Sparkline tendencia7={tendencia7} />
        </CardContent>
      </Card>
    </div>
  );
}
