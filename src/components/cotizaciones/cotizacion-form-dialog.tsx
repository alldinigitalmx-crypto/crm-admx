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
import { CotizacionForm } from "@/components/cotizaciones/cotizacion-form";
import type { CotizacionFormState } from "@/app/admin/cotizaciones/actions";

type CotizacionDefaults = {
  descuentoTipo: string | null;
  descuentoValor: number | string | { toString(): string } | null;
  descuentoMotivo: string | null;
  fechaVencimiento: Date | null;
};

export function CotizacionFormDialog({
  trigger,
  title,
  description,
  action,
  montoSubtotal,
  defaultValues,
  submitLabel,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (
    prevState: CotizacionFormState,
    formData: FormData
  ) => Promise<CotizacionFormState>;
  montoSubtotal: number;
  defaultValues?: CotizacionDefaults;
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
        <CotizacionForm
          action={action}
          montoSubtotal={montoSubtotal}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
