"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UsuarioFormState } from "@/app/admin/usuarios/actions";

type UsuarioDefaults = {
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

export function UsuarioForm({
  action,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: UsuarioFormState, formData: FormData) => Promise<UsuarioFormState>;
  defaultValues?: UsuarioDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const isEditing = Boolean(defaultValues);

  const wrappedAction = async (prevState: UsuarioFormState, formData: FormData) => {
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
          placeholder="Ej. María López"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={defaultValues?.email ?? ""}
          placeholder="correo@empresa.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña {isEditing ? "" : "*"}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required={!isEditing}
          placeholder={isEditing ? "Dejar en blanco para no cambiar" : "Mínimo 6 caracteres"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rol">Rol</Label>
          <Select name="rol" defaultValue={defaultValues?.rol ?? "Interno"}>
            <SelectTrigger id="rol" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Interno">Interno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-end gap-2 pb-1.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id="activo"
              name="activo"
              defaultChecked={defaultValues?.activo ?? true}
            />
            <Label htmlFor="activo" className="font-normal">
              Activo (puede iniciar sesión)
            </Label>
          </div>
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
