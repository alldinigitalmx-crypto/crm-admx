"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductoFormState } from "@/app/admin/productos/actions";

type ProductoDefaults = {
  nombre: string;
  descripcion: string | null;
  categoria: string;
  precio: number | string | { toString(): string };
  costoReferencia: (number | string | { toString(): string }) | null;
  requiereCotizacion: boolean;
  activo: boolean;
};

export function ProductoForm({
  action,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: ProductoFormState, formData: FormData) => Promise<ProductoFormState>;
  defaultValues?: ProductoDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: ProductoFormState, formData: FormData) => {
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
          placeholder="Ej. Plantilla de landing page"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={2}
          defaultValue={defaultValues?.descripcion ?? ""}
          placeholder="Opcional"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoria">Categoría</Label>
          <Select name="categoria" defaultValue={defaultValues?.categoria ?? "Plantilla"}>
            <SelectTrigger id="categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Plantilla">Plantilla</SelectItem>
              <SelectItem value="Sistema">Sistema</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="precio">Precio *</Label>
          <Input
            id="precio"
            name="precio"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaultValues?.precio ? String(defaultValues.precio) : ""}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="costoReferencia">Costo de referencia</Label>
          <Input
            id="costoReferencia"
            name="costoReferencia"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              defaultValues?.costoReferencia ? String(defaultValues.costoReferencia) : ""
            }
            placeholder="Opcional — para calcular margen"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="requiereCotizacion"
            name="requiereCotizacion"
            defaultChecked={defaultValues?.requiereCotizacion ?? false}
          />
          <Label htmlFor="requiereCotizacion" className="font-normal">
            Requiere cotización (no tiene precio fijo cerrado)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="activo"
            name="activo"
            defaultChecked={defaultValues?.activo ?? true}
          />
          <Label htmlFor="activo" className="font-normal">
            Activo (disponible para nuevas ventas)
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
