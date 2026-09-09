"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Mismo campo de contraseña de siempre (ícono de candado + input) pero
// con un botón para alternar entre ocultarla y mostrarla en claro --
// útil sobre todo en el login para revisar que no haya un typo antes de
// mandar el formulario, en vez de adivinar por qué "la contraseña
// correcta" no entra.
export function PasswordField({
  id,
  name,
  required,
  placeholder = "••••••••",
  minLength,
  className,
}: {
  id: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete="current-password"
        className={cn("pl-9 pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // No debe robarse el foco del tab order del formulario -- es un
        // atajo visual, no un campo más que llenar.
        tabIndex={-1}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
