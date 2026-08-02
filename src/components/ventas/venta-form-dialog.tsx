"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VentaForm, type ProductoOption, type ClienteOption } from "@/components/ventas/venta-form";
import type { VentaFormState } from "@/app/admin/ventas/actions";

type LineaItem = { productoId: string; cantidad: number; precioUnitario: number };

type VentaDefaults = {
  fecha: Date;
  origen: string;
  canal: string | null;
  nombreComprador: string | null;
  emailComprador: string | null;
  metodoPago: string | null;
  tipoEntrega: string;
  referidoPorId: number | null;
  comisionReferido: (number | string | { toString(): string }) | null;
  items: LineaItem[];
};

export function VentaFormDialog({
  trigger,
  title,
  description,
  action,
  productos,
  clientes,
  defaultValues,
  submitLabel,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  action: (prevState: VentaFormState, formData: FormData) => Promise<VentaFormState>;
  productos: ProductoOption[];
  clientes: ClienteOption[];
  defaultValues?: VentaDefaults;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Nueva venta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <VentaForm
          action={action}
          productos={productos}
          clientes={clientes}
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
