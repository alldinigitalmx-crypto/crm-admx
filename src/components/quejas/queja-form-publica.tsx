"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuejaFormState } from "@/app/admin/quejas/actions";

const CATEGORIAS = [
  { value: "Sugerencia", label: "Sugerencia" },
  { value: "Falla", label: "Falla o error" },
  { value: "Cobro", label: "Cobro" },
  { value: "Atencion", label: "Atención" },
  { value: "Otro", label: "Otro" },
];

export function QuejaFormPublica({
  action,
}: {
  action: (prevState: QuejaFormState, formData: FormData) => Promise<QuejaFormState>;
}) {
  const [enviado, setEnviado] = useState(false);
  const wrappedAction = async (prevState: QuejaFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) setEnviado(true);
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);

  if (enviado) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4.5 shrink-0" />
        <p>¡Gracias! La recibimos y te responderemos pronto.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="categoria">Tipo</Label>
        <Select name="categoria" required defaultValue="Sugerencia">
          <SelectTrigger id="categoria" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descripcion">Cuéntanos</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          required
          rows={3}
          placeholder="Escribe tu queja o sugerencia..."
        />
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
