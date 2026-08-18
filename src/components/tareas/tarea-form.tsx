"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TareaFormState } from "@/app/admin/tareas/actions";

export type VinculoOption = { value: string; label: string };

export type TareaDefaultValues = {
  titulo: string;
  descripcion: string | null;
  prioridad: string;
  fechaLimite: Date | null;
  asignadoAId: number | null;
  vinculo?: string;
};

export function TareaForm({
  action,
  vinculos,
  vinculoFijo,
  usuarios,
  usuarioActualId,
  onSuccess,
  defaultValues,
  submitLabel = "Crear tarea",
}: {
  action: (
    prevState: TareaFormState,
    formData: FormData
  ) => Promise<TareaFormState>;
  vinculos?: VinculoOption[];
  vinculoFijo?: { value: string; label: string };
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
  onSuccess?: () => void;
  defaultValues?: TareaDefaultValues;
  submitLabel?: string;
}) {
  const wrappedAction = async (prevState: TareaFormState, formData: FormData) => {
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
          placeholder="Ej. Crear reunión de Meet"
          defaultValue={defaultValues?.titulo}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={2}
          placeholder="Detalles opcionales"
          defaultValue={defaultValues?.descripcion ?? undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select name="prioridad" defaultValue={defaultValues?.prioridad ?? "Media"}>
            <SelectTrigger id="prioridad" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Baja">Baja</SelectItem>
              <SelectItem value="Media">Media</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fechaLimite">Fecha límite</Label>
          <Input
            id="fechaLimite"
            name="fechaLimite"
            type="date"
            defaultValue={
              defaultValues?.fechaLimite
                ? new Date(defaultValues.fechaLimite).toISOString().slice(0, 10)
                : undefined
            }
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="asignadoAId">Asignado a</Label>
          <Select
            name="asignadoAId"
            defaultValue={
              defaultValues?.asignadoAId
                ? String(defaultValues.asignadoAId)
                : usuarioActualId
                  ? String(usuarioActualId)
                  : undefined
            }
          >
            <SelectTrigger id="asignadoAId" className="w-full">
              <SelectValue placeholder="Selecciona un responsable" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {vinculos && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="vinculo">Vincular a</Label>
            <Select name="vinculo" defaultValue={defaultValues?.vinculo ?? "none"}>
              <SelectTrigger id="vinculo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {vinculos.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {vinculoFijo && (
          <input type="hidden" name="vinculo" value={vinculoFijo.value} />
        )}
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
