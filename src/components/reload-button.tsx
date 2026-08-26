"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Instalada como app ("Agregar a pantalla de inicio"), no hay barra del
// navegador ni gesto de "jalar para recargar" -- sin este botón no hay
// forma de refrescar la página una vez abierta.
export function ReloadButton() {
  const [girando, setGirando] = useState(false);

  function onClick() {
    if (girando) return;
    setGirando(true);
    // Un giro completo (misma duración que animate-spin) antes de
    // recargar, para que la animación de verdad se alcance a ver — si se
    // recarga en el mismo tick, la página cambia antes de que el ícono
    // gire nada.
    window.setTimeout(() => window.location.reload(), 500);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title="Recargar página"
      onClick={onClick}
      disabled={girando}
    >
      <RefreshCw className={girando ? "animate-spin" : undefined} />
    </Button>
  );
}
