import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRIORIDAD_COLOR } from "@/lib/status-colors";
import type { ResumenTareas } from "@/lib/tareas-resumen";

const PRIORIDAD_LABEL: Record<string, string> = {
  Alta: "Alta prioridad",
  Media: "Prioridad media",
  Baja: "Prioridad baja",
};

export function TareasResumen({ resumen }: { resumen: ResumenTareas }) {
  const { pendientesCount, completadasHoy, progresoPct, racha, proximaPrioridad } = resumen;
  const totalHoy = pendientesCount + completadasHoy;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="flex flex-col gap-1 py-2">
          <p className="text-xs text-muted-foreground">Progreso de hoy</p>
          <p className="text-2xl font-semibold">
            {completadasHoy} <span className="text-base font-normal text-muted-foreground">de {totalHoy}</span>
          </p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
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
            <Badge className={`w-fit text-sm ${PRIORIDAD_COLOR[proximaPrioridad]}`}>
              {PRIORIDAD_LABEL[proximaPrioridad]}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes 🎉</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
