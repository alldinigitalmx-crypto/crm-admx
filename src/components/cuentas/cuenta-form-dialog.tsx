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
import { CuentaForm } from "@/components/cuentas/cuenta-form";
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

export function CuentaFormDialog({
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
  action: (prevState: CuentaFormState, formData: FormData) => Promise<CuentaFormState>;
  defaultValues?: CuentaDefaults;
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
        <CuentaForm
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
