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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

  const form = (
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
  );

  // En celular, un modal chico obliga a apretujar el formulario -- un
  // sheet que sube desde abajo y ocupa casi toda la pantalla da más
  // espacio real para los campos, sin tocar el layout de escritorio.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="p-0">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
