"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolverTicketAcceso } from "@/app/admin/usuarios/actions";
import type { NivelPermiso } from "@/generated/prisma/client";

export function AprobarTicketButton({ ticketId }: { ticketId: number }) {
  const [open, setOpen] = useState(false);

  const wrappedAction = async (_prevState: undefined, formData: FormData) => {
    const nivel = String(formData.get("nivel") ?? "Ver") as NivelPermiso;
    await resolverTicketAcceso(ticketId, "Aprobado", nivel);
    setOpen(false);
    return undefined;
  };
  const [, formAction, isPending] = useActionState(wrappedAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Aprobar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Aprobar acceso</DialogTitle>
          <DialogDescription>
            Elige el nivel de acceso que se otorgará para este módulo.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <Select name="nivel" defaultValue="Ver">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ver">Ver</SelectItem>
              <SelectItem value="Crear">Crear</SelectItem>
              <SelectItem value="Editar">Editar</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Aprobando..." : "Aprobar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RechazarTicketButton({ ticketId }: { ticketId: number }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Rechazar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Rechazar esta solicitud?</AlertDialogTitle>
          <AlertDialogDescription>
            El usuario no recibirá el acceso solicitado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => resolverTicketAcceso(ticketId, "Rechazado")}>
            Rechazar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
