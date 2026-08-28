"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProyectoForm } from "@/components/portafolio/proyecto-form";
import type { ProyectoFormState } from "@/app/admin/portafolio/actions";

type ProyectoDefaults = {
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  linkExterno: string | null;
  destacado: boolean;
  activo: boolean;
};

export function ProyectoFormDialog({
  trigger,
  title,
  action,
  defaultValues,
  submitLabel,
}: {
  trigger: React.ReactNode;
  title: string;
  action: (prevState: ProyectoFormState, formData: FormData) => Promise<ProyectoFormState>;
  defaultValues?: ProyectoDefaults;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ProyectoForm
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
