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
import { GastoForm } from "@/components/gastos/gasto-form";
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

export function GastoFormDialog({
  trigger,
  title,
  description,
  action,
  defaultValues,
  submitLabel,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (
    prevState: GastoFormState,
    formData: FormData
  ) => Promise<GastoFormState>;
  defaultValues?: GastoDefaults;
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
        <GastoForm
          action={action}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
