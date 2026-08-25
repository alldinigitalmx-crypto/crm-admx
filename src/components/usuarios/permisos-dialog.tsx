"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { guardarPermisos } from "@/app/admin/usuarios/actions";
import { MODULOS, MODULO_LABEL } from "@/lib/modulo-sistema";

const MODULOS_CON_ALCANCE = ["Clientes", "Servicios", "Cotizaciones", "Pagos", "Quejas", "Tareas"];

export function PermisosDialog({
  trigger,
  usuarioId,
  permisos,
  alcances,
}: {
  trigger: React.ReactNode;
  usuarioId: number;
  permisos: Record<string, string>;
  alcances: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  const wrappedAction = async (_prevState: undefined, formData: FormData) => {
    const permisosNuevos = Object.fromEntries(
      MODULOS.map((modulo) => [
        modulo,
        {
          nivel: String(formData.get(`permiso_${modulo}`) ?? "none"),
          alcance: String(formData.get(`alcance_${modulo}`) ?? "Propio"),
        },
      ])
    );
    await guardarPermisos(usuarioId, permisosNuevos);
    setOpen(false);
    return undefined;
  };
  const [, formAction, isPending] = useActionState(wrappedAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md" style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>Permisos por módulo</DialogTitle>
          <DialogDescription>
            Nivel de acceso en cada apartado del sistema.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          {MODULOS.map((modulo) => (
            <div key={modulo} className="flex flex-col gap-1.5 border-b pb-2 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-normal">{MODULO_LABEL[modulo]}</Label>
                <Select name={`permiso_${modulo}`} defaultValue={permisos[modulo] ?? "none"}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin acceso</SelectItem>
                    <SelectItem value="Ver">Ver</SelectItem>
                    <SelectItem value="Crear">Crear</SelectItem>
                    <SelectItem value="Editar">Editar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {MODULOS_CON_ALCANCE.includes(modulo) && (
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-normal text-muted-foreground">
                    Alcance de datos
                  </Label>
                  <Select
                    name={`alcance_${modulo}`}
                    defaultValue={alcances[modulo] ?? "Propio"}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Propio">Solo lo suyo</SelectItem>
                      <SelectItem value="Todo">Ve todo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? "Guardando..." : "Guardar permisos"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
