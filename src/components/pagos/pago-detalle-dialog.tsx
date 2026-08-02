"use client";

import { useActionState, useState } from "react";
import { Eye, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  ComprobanteFormState,
  eliminarComprobantePago,
} from "@/app/admin/pagos/actions";

export type PagoDetalle = {
  id: number;
  fecha: Date;
  metodoPago: string;
  monto: number | string | { toString(): string };
  comision: (number | string | { toString(): string }) | null;
  moneda: string | null;
  cuenta: string | null;
  comprobante: string | null;
  confirmado: boolean;
  servicio: { descripcion: string; cliente: { nombre: string } };
};

export type ComprobanteArchivo = { id: number; url: string; nombre: string };

function ComprobanteImagenForm({
  action,
  onSuccess,
}: {
  action: (
    prevState: ComprobanteFormState,
    formData: FormData
  ) => Promise<ComprobanteFormState>;
  onSuccess?: () => void;
}) {
  const wrappedAction = async (prevState: ComprobanteFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) onSuccess?.();
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);
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

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Input type="file" accept="image/*" onChange={onFileChange} />
      {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
      <input type="hidden" name="imagen" value={dataUrl ?? ""} />
      <Button type="submit" size="sm" disabled={isPending || !dataUrl} className="self-start">
        {isPending ? "Subiendo..." : "Subir comprobante"}
      </Button>
    </form>
  );
}

export function PagoDetalleDialog({
  pago,
  comprobanteArchivo,
  servicioId,
  subirComprobante,
  eliminarComprobante,
}: {
  pago: PagoDetalle;
  comprobanteArchivo: ComprobanteArchivo | null;
  servicioId: number;
  subirComprobante: (
    prevState: ComprobanteFormState,
    formData: FormData
  ) => Promise<ComprobanteFormState>;
  eliminarComprobante: typeof eliminarComprobantePago;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle del pago</DialogTitle>
          <DialogDescription>
            {pago.servicio.descripcion} — {pago.servicio.cliente.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p>{formatDate(pago.fecha)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Método</p>
              <p>{pago.metodoPago}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cuenta</p>
              <p>{pago.cuenta ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Moneda</p>
              <p>{pago.moneda ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Monto</p>
              <p className="font-medium">{formatCurrency(pago.monto)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Comisión</p>
              <p>{pago.comision ? formatCurrency(pago.comision) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={pago.confirmado ? "secondary" : "outline"}>
                {pago.confirmado ? "Confirmado" : "Pendiente"}
              </Badge>
            </div>
          </div>

          {pago.comprobante && (
            <div>
              <p className="text-muted-foreground">Referencia</p>
              <p>{pago.comprobante}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-3">
            <Label>Comprobante (imagen)</Label>
            {comprobanteArchivo ? (
              <div className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- comprobante guardado como dataURL */}
                <img
                  src={comprobanteArchivo.url}
                  alt="Comprobante de pago"
                  className="max-h-72 w-full rounded-lg border border-input object-contain"
                />
                <form
                  action={eliminarComprobante.bind(null, comprobanteArchivo.id, servicioId)}
                >
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                    Eliminar comprobante
                  </Button>
                </form>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Opcional — puedes subir una foto o captura del comprobante.
                </p>
                <ComprobanteImagenForm action={subirComprobante} />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
