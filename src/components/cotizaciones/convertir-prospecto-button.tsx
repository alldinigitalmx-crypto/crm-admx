"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClienteRapidoDialog } from "@/components/clientes/cliente-rapido-dialog";
import { crearClienteRapido } from "@/app/admin/clientes/actions";

/** Botón "Convertir en cliente" de una cotización de prospecto — al crear
 * el cliente (ya vinculado a la cotización dentro de la acción), refresca
 * la página para que se vea como cliente registrado de una vez. */
export function ConvertirProspectoButton({
  cotizacionId,
  defaultNombre,
}: {
  cotizacionId: number;
  defaultNombre: string;
}) {
  const router = useRouter();
  const action = useMemo(
    () => crearClienteRapido.bind(null, cotizacionId),
    [cotizacionId]
  );

  return (
    <ClienteRapidoDialog
      trigger={
        <Button type="button" size="sm">
          <UserPlus />
          Convertir en cliente
        </Button>
      }
      title="Convertir prospecto en cliente"
      description={`Se registrará "${defaultNombre}" como cliente y quedará vinculado a esta cotización.`}
      defaultNombre={defaultNombre}
      action={action}
      onCreated={() => router.refresh()}
    />
  );
}
