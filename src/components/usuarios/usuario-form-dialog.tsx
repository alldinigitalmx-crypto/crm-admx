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
import { UsuarioForm } from "@/components/usuarios/usuario-form";
import type { UsuarioFormState } from "@/app/admin/usuarios/actions";

type UsuarioDefaults = {
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

export function UsuarioFormDialog({
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
  action: (prevState: UsuarioFormState, formData: FormData) => Promise<UsuarioFormState>;
  defaultValues?: UsuarioDefaults;
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
        <UsuarioForm
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
