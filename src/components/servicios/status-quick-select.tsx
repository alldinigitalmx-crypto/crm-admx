"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { StatusServicio } from "@/generated/prisma/client";
import { SERVICIO_STATUS_COLOR } from "@/lib/status-colors";

const STATUSES: StatusServicio[] = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"];

// Cambia el status de un servicio con un solo click, sin abrir el
// formulario de edición completo -- se ve como el badge de siempre pero
// es un <select> nativo por debajo, así que funciona igual de bien con
// mouse, teclado y en móvil sin JS extra de dropdown.
export function StatusQuickSelect({
  servicioId,
  status,
  action,
}: {
  servicioId: number;
  status: StatusServicio;
  action: (id: number, nuevoStatus: StatusServicio) => Promise<void>;
}) {
  const [statusOptimista, setStatusOptimista] = useState(status);
  const [isPending, startTransition] = useTransition();

  function onChange(nuevo: StatusServicio) {
    setStatusOptimista(nuevo);
    startTransition(async () => {
      await action(servicioId, nuevo);
    });
  }

  return (
    <div className="relative inline-flex">
      <select
        value={statusOptimista}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as StatusServicio)}
        onClick={(e) => e.stopPropagation()}
        className={`appearance-none rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-medium outline-none disabled:opacity-60 ${SERVICIO_STATUS_COLOR[statusOptimista]}`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-popover text-foreground">
            {s}
          </option>
        ))}
      </select>
      {isPending && (
        <Loader2 className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 animate-spin" />
      )}
    </div>
  );
}
