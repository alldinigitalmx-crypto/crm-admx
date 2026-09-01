import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { crearTarea } from "@/app/admin/tareas/actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaLista } from "@/components/tareas/tarea-lista";
import { COTIZACION_STATUS_COLOR, COTIZACION_STATUS_ICON } from "@/lib/status-colors";

// Un "prospecto" es, a propósito, solo un Cliente con la etiqueta que ya
// existía en el módulo Clientes -- sin tabla nueva, sin duplicar datos
// de contacto. El status que se muestra es el de su cotización más
// reciente (el mismo embudo Enviada→Firmada→Pagada/Vencida/Perdida que
// ya usa Cotizaciones); si todavía no tiene ninguna, se ve "Sin
// propuesta". El seguimiento (WhatsApp, llamada, lo que sea) se agenda
// como una Tarea normal ligada a este cliente -- mismo tablero de
// /admin/tareas, solo que aquí se ve de un vistazo por prospecto.
export default async function ProspectosPage() {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Clientes");
  if (!permisos.puedeVer) redirect("/admin");

  const [prospectos, usuarios] = await Promise.all([
    prisma.cliente.findMany({
      where: { etiqueta: "Prospecto" },
      include: {
        cotizaciones: {
          orderBy: { creadoEn: "desc" },
          take: 1,
          select: { status: true },
        },
        tareas: {
          where: { completada: false },
          orderBy: [{ fechaLimite: "asc" }, { creadoEn: "desc" }],
        },
      },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospectos</h1>
        <p className="text-sm text-muted-foreground">
          {prospectos.length} prospecto{prospectos.length === 1 ? "" : "s"} — clientes etiquetados
          &quot;Prospecto&quot;
        </p>
      </div>

      {prospectos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aún no tienes prospectos. Etiqueta un cliente como &quot;Prospecto&quot; desde su ficha
            (en Clientes) para que aparezca aquí.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {prospectos.map((p) => {
            const cotizacion = p.cotizaciones[0];
            const Icono = cotizacion ? COTIZACION_STATUS_ICON[cotizacion.status] : null;
            // El campo de teléfono en Clientes no fuerza un formato --
            // se manda solo lo que ya sea puro dígito (con o sin lada
            // internacional, lo que haya guardado quien lo capturó).
            const digitos = p.telefono?.replace(/\D/g, "") ?? "";
            const whatsapp = digitos ? `https://wa.me/${digitos}` : null;

            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <Link href={`/admin/clientes/${p.id}`} className="font-semibold hover:underline">
                      {p.nombre}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.telefono, p.email, p.pais].filter(Boolean).join(" · ") ||
                        "Sin datos de contacto"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {cotizacion ? (
                      <Badge className={COTIZACION_STATUS_COLOR[cotizacion.status]}>
                        {Icono && <Icono className="mr-1 size-3" />}
                        {cotizacion.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sin propuesta</Badge>
                    )}
                    {whatsapp && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                          <MessageCircle />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Seguimiento</p>
                    <TareaFormDialog
                      action={crearTarea}
                      vinculoFijo={{ value: `cliente:${p.id}`, label: p.nombre }}
                      usuarios={usuarios}
                      usuarioActualId={usuario?.id}
                      triggerLabel="+ Tarea"
                      title={`Nueva tarea — ${p.nombre}`}
                      description="Recordatorio de seguimiento (llamada, WhatsApp, propuesta, etc.)."
                    />
                  </div>
                  <TareaLista tareas={p.tareas} emptyText="Sin tareas de seguimiento pendientes." />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
