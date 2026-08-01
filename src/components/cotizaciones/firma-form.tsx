"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/cotizaciones/signature-pad";
import type { PublicActionState } from "@/app/admin/cotizaciones/actions";

export function FirmaForm({
  action,
  nombreDefault,
}: {
  action: (
    prevState: PublicActionState,
    formData: FormData
  ) => Promise<PublicActionState>;
  nombreDefault: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  if (state?.success) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        Firma registrada correctamente.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="firmanteNombre">Nombre completo</Label>
        <Input
          id="firmanteNombre"
          name="firmanteNombre"
          required
          defaultValue={nombreDefault}
        />
      </div>
      <SignaturePad name="firma" />
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Firmando..." : "Firmar cotización"}
      </Button>
    </form>
  );
}
