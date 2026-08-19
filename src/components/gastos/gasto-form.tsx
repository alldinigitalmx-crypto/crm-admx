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
import type { GastoFormState } from "@/app/admin/gastos/actions";

type GastoDefaults = {
  descripcion: string;
  categoria: string;
  ambito: string;
  monto: number | string | { toString(): string };
  metodoPago: string | null;
  fecha: Date;
  comprobante: string | null;
  notas: string | null;
};

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function GastoForm({
  action,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (
    prevState: GastoFormState,
    formData: FormData
  ) => Promise<GastoFormState>;
  defaultValues?: GastoDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: GastoFormState, formData: FormData) => {
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
        <Label htmlFor="descripcion">Descripción *</Label>
        <Input
          id="descripcion"
          name="descripcion"
          required
          defaultValue={defaultValues?.descripcion ?? ""}
          placeholder="Ej. Hosting mensual"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoria">Categoría *</Label>
          <Input
            id="categoria"
            name="categoria"
            required
            list="categorias-gasto"
            defaultValue={defaultValues?.categoria ?? ""}
            placeholder="Ej. Software, Publicidad..."
          />
          <datalist id="categorias-gasto">
            <option value="Software" />
            <option value="Publicidad" />
            <option value="Hosting/Dominios" />
            <option value="Equipo" />
            <option value="Freelancers" />
            <option value="Impuestos" />
            <option value="Otro" />
          </datalist>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ambito">Ámbito</Label>
          <Select name="ambito" defaultValue={defaultValues?.ambito ?? "Empresa"}>
            <SelectTrigger id="ambito" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Empresa">Empresa</SelectItem>
              <SelectItem value="Personal">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="monto">Monto *</Label>
          <Input
            id="monto"
            name="monto"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaultValues?.monto ? String(defaultValues.monto) : ""}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.fecha) || toDateInputValue(new Date())}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="metodoPago">Método de pago</Label>
          <Select name="metodoPago" defaultValue={defaultValues?.metodoPago ?? "none"}>
            <SelectTrigger id="metodoPago" className="w-full">
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin especificar</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
              <SelectItem value="MercadoPago">Mercado Pago</SelectItem>
              <SelectItem value="PayPal">PayPal</SelectItem>
              <SelectItem value="Tarjeta">Tarjeta</SelectItem>
              <SelectItem value="WesternUnion">Western Union</SelectItem>
              <SelectItem value="Binance">Binance</SelectItem>
              <SelectItem value="Deposito">Depósito</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="comprobante">Comprobante / referencia</Label>
          <Input
            id="comprobante"
            name="comprobante"
            defaultValue={defaultValues?.comprobante ?? ""}
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="notas">Notas</Label>
          <Textarea
            id="notas"
            name="notas"
            rows={2}
            defaultValue={defaultValues?.notas ?? ""}
            placeholder="Notas opcionales"
          />
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
