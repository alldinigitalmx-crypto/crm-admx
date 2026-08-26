"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Instalada como app ("Agregar a pantalla de inicio"), no hay barra del
// navegador ni gesto de "jalar para recargar" -- sin este botón no hay
// forma de refrescar la página una vez abierta.
export function ReloadButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title="Recargar página"
      onClick={() => window.location.reload()}
    >
      <RefreshCw />
    </Button>
  );
}
