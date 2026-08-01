"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PublicActionState } from "@/app/admin/cotizaciones/actions";

export function PagoTransferenciaForm({
  action,
}: {
  action: (
    prevState: PublicActionState,
    formData: FormData
  ) => Promise<PublicActionState>;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  if (state?.success) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        Comprobante recibido. Tu pago quedó pendiente de confirmación.
      </p>
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
        <Label htmlFor="comprobanteFile">Comprobante de transferencia *</Label>
        <Input
          id="comprobanteFile"
          type="file"
          accept="image/*,application/pdf"
          onChange={onFileChange}
          required
        />
        {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
        <input type="hidden" name="comprobante" value={dataUrl ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="referencia">Referencia (opcional)</Label>
        <Textarea
          id="referencia"
          name="referencia"
          rows={2}
          placeholder="Número de referencia o notas"
        />
      </div>
      <Button type="submit" disabled={isPending || !dataUrl} className="self-start">
        {isPending ? "Enviando..." : "Reportar pago por transferencia"}
      </Button>
    </form>
  );
}
