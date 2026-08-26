"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PagoForm, type ServicioOption, type CuentaOption } from "@/components/pagos/pago-form";
import type { PagoFormState } from "@/app/admin/pagos/actions";

type PagoDefaults = {
  servicioId: number;
  fecha: Date;
  metodoPago: string;
  monto: number | string | { toString(): string };
  comision: (number | string | { toString(): string }) | null;
  moneda: string | null;
  montoMXN: (number | string | { toString(): string }) | null;
  cuentaId: number | null;
  comprobante: string | null;
  confirmado: boolean;
};

export function PagoFormDialog({
  trigger,
  title,
  description,
  action,
  servicios,
  servicioFijo,
  cuentas,
  defaultValues,
  comprobanteExistente,
  submitLabel,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (prevState: PagoFormState, formData: FormData) => Promise<PagoFormState>;
  servicios?: ServicioOption[];
  servicioFijo?: { id: number; label: string };
  cuentas?: CuentaOption[];
  defaultValues?: PagoDefaults;
  comprobanteExistente?: { nombre: string } | null;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <PagoForm
          action={action}
          servicios={servicios}
          servicioFijo={servicioFijo}
          cuentas={cuentas}
          defaultValues={defaultValues}
          comprobanteExistente={comprobanteExistente}
          submitLabel={submitLabel}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
