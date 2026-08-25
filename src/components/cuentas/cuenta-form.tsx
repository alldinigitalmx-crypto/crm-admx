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
import type { CuentaFormState } from "@/app/admin/cuentas/actions";

type CuentaDefaults = {
  alias: string;
  tipo: string;
  banco: string | null;
  numeroCuenta: string | null;
  clabe: string | null;
  swift: string | null;
  saldoInicial: number | string | { toString(): string };
  activa: boolean;
  notas: string | null;
};

export function CuentaForm({
  action,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: CuentaFormState, formData: FormData) => Promise<CuentaFormState>;
  defaultValues?: CuentaDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: CuentaFormState, formData: FormData) => {
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
        <Label htmlFor="alias">Alias *</Label>
        <Input
          id="alias"
          name="alias"
          required
          defaultValue={defaultValues?.alias ?? ""}
          placeholder="Ej. BBVA principal, Efectivo, Spin OXXO..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" defaultValue={defaultValues?.tipo ?? "Banco"}>
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Banco">Banco</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Billetera">Billetera (Spin, PayPal, Mercado Pago...)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="banco">Banco / plataforma</Label>
          <Input
            id="banco"
            name="banco"
            defaultValue={defaultValues?.banco ?? ""}
            placeholder="Ej. BBVA, Spin, Mercado Pago..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="numeroCuenta">Número de cuenta</Label>
          <Input id="numeroCuenta" name="numeroCuenta" defaultValue={defaultValues?.numeroCuenta ?? ""} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="clabe">CLABE / referencia</Label>
          <Input id="clabe" name="clabe" defaultValue={defaultValues?.clabe ?? ""} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="swift">SWIFT</Label>
          <Input id="swift" name="swift" defaultValue={defaultValues?.swift ?? ""} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="saldoInicial">Saldo inicial</Label>
          <Input
            id="saldoInicial"
            name="saldoInicial"
            type="number"
            step="0.01"
            defaultValue={defaultValues?.saldoInicial ? String(defaultValues.saldoInicial) : "0"}
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground">
            Con lo que arrancó la cuenta antes de llevarle la cuenta aquí — el disponible se
            calcula desde este número.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={2} defaultValue={defaultValues?.notas ?? ""} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="activa" name="activa" defaultChecked={defaultValues?.activa ?? true} />
        <Label htmlFor="activa" className="font-normal">
          Cuenta activa (aparece como destino al registrar pagos y gastos)
        </Label>
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
