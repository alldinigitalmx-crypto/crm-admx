"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IntermediarioFormState } from "@/app/admin/intermediarios/actions";

type IntermediarioDefaults = {
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
};

export function IntermediarioForm({
  action,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (
    prevState: IntermediarioFormState,
    formData: FormData
  ) => Promise<IntermediarioFormState>;
  defaultValues?: IntermediarioDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: IntermediarioFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) onSuccess?.();
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          defaultValue={defaultValues?.nombre ?? ""}
          placeholder="Ej. Juan Pérez"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            defaultValue={defaultValues?.telefono ?? ""}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          name="notas"
          rows={3}
          defaultValue={defaultValues?.notas ?? ""}
          placeholder="Opcional"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
