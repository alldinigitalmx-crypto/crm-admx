"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// En escritorio los filtros siempre se ven completos (hay espacio de
// sobra); en móvil, por default, quedan contraídos para no acaparar la
// pantalla antes de llegar al listado -- se abren tocando el encabezado.
// Si ya hay filtros aplicados arrancan abiertos, para que el usuario vea
// de una vez qué está filtrando.
export function FiltrosCard({
  children,
  activo,
}: {
  children: React.ReactNode;
  activo: boolean;
}) {
  const [open, setOpen] = useState(activo);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none md:cursor-default"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Filtros
            {activo && <span className="ml-1.5 text-xs font-normal text-primary">· activos</span>}
          </CardTitle>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform md:hidden ${open ? "rotate-180" : ""}`}
          />
        </div>
      </CardHeader>
      <CardContent className={`${open ? "block" : "hidden"} md:block`}>{children}</CardContent>
    </Card>
  );
}
