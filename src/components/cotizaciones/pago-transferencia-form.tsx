"use client";

import { useActionState, useState } from "react";
import { Copy, Check } from "lucide-react";

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
import { businessInfo } from "@/lib/business-info";
import { formatCurrency } from "@/lib/format";
import type { PublicActionState } from "@/app/admin/cotizaciones/actions";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s+/g, ""));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin acceso al portapapeles (navegador viejo/permiso denegado) — el
      // usuario igual puede seleccionar y copiar el texto a mano.
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono">{value}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copiar} className="shrink-0">
        {copiado ? <Check /> : <Copy />}
        {copiado ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

const METODOS = [
  { value: "Transferencia", label: "Transferencia bancaria (BBVA)" },
  { value: "Spin", label: "Spin by OXXO" },
  { value: "Binance", label: "Binance" },
] as const;

export function PagoTransferenciaForm({
  action,
  montoAPagar,
}: {
  action: (
    prevState: PublicActionState,
    formData: FormData
  ) => Promise<PublicActionState>;
  montoAPagar?: number;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<string>("Transferencia");

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
    <div className="flex flex-col gap-4">
      {montoAPagar !== undefined && (
        <p className="text-sm">
          Monto a transferir: <span className="font-semibold">{formatCurrency(montoAPagar)}</span>
        </p>
      )}
      <div className="flex flex-col gap-3 rounded-lg border border-input bg-muted/30 p-3">
        <div className="flex flex-col gap-2 border-b pb-3">
          <p className="text-xs font-medium text-muted-foreground">
            Transferencia bancaria — {businessInfo.banco.nombre}
          </p>
          <CopyField label="Cuenta" value={businessInfo.banco.cuenta} />
          <CopyField label="CLABE" value={businessInfo.banco.clabe} />
        </div>
        <div className="flex flex-col gap-2 border-b pb-3">
          <p className="text-xs font-medium text-muted-foreground">Spin by OXXO</p>
          <CopyField label="Cuenta" value={businessInfo.spin.cuenta} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Binance</p>
          <CopyField label="Correo" value={businessInfo.binance.correo} />
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        {state?.error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="metodoPago">¿Con cuál pagaste?</Label>
          <Select name="metodoPago" value={metodo} onValueChange={setMetodo}>
            <SelectTrigger id="metodoPago" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METODOS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="comprobanteFile">Comprobante de pago *</Label>
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
          {isPending ? "Enviando..." : "Reportar pago"}
        </Button>
      </form>
    </div>
  );
}
