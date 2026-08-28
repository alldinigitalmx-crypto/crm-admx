"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProyectoFormState } from "@/app/admin/portafolio/actions";

type ProyectoDefaults = {
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  linkExterno: string | null;
  destacado: boolean;
  activo: boolean;
};

export function ProyectoForm({
  action,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: ProyectoFormState, formData: FormData) => Promise<ProyectoFormState>;
  defaultValues?: ProyectoDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: ProyectoFormState, formData: FormData) => {
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
        <Label htmlFor="titulo">Título *</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          defaultValue={defaultValues?.titulo ?? ""}
          placeholder="Ej. CRM para Distrilicores"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          defaultValue={defaultValues?.descripcion ?? ""}
          placeholder="Qué hace este sistema, en una o dos líneas..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoria">Categoría</Label>
          <Input
            id="categoria"
            name="categoria"
            defaultValue={defaultValues?.categoria ?? ""}
            placeholder="Ej. CRM, E-commerce, Landing..."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="linkExterno">Liga (opcional)</Label>
          <Input
            id="linkExterno"
            name="linkExterno"
            type="url"
            defaultValue={defaultValues?.linkExterno ?? ""}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Checkbox id="destacado" name="destacado" defaultChecked={defaultValues?.destacado ?? false} />
          <Label htmlFor="destacado" className="font-normal">
            Destacado
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="activo" name="activo" defaultChecked={defaultValues?.activo ?? true} />
          <Label htmlFor="activo" className="font-normal">
            Visible en la landing
          </Label>
        </div>
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
