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
import { ServicioForm } from "@/components/servicios/servicio-form";
import type { ServicioFormState } from "@/app/admin/servicios/actions";

type ServicioDefaults = {
  clienteId: number;
  descripcion: string;
  detalles: string | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  montoInicial: number | string | { toString(): string };
  status: string;
  intermediarioId: number | null;
  porcentajeIntermediario: (number | string | { toString(): string }) | null;
  responsableId: number | null;
};

export function ServicioFormDialog({
  trigger,
  title,
  description,
  action,
  clientes,
  intermediarios,
  usuarios,
  usuarioActualId,
  defaultValues,
  submitLabel,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (
    prevState: ServicioFormState,
    formData: FormData
  ) => Promise<ServicioFormState>;
  clientes: { id: number; nombre: string }[];
  intermediarios: { id: number; nombre: string }[];
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
  defaultValues?: ServicioDefaults;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ServicioForm
          action={action}
          clientes={clientes}
          intermediarios={intermediarios}
          usuarios={usuarios}
          usuarioActualId={usuarioActualId}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
