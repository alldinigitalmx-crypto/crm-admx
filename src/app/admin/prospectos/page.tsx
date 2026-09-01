import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { permisosModulo } from "@/lib/alcance";
import { crearTarea } from "@/app/admin/tareas/actions";
import { whatsappHref } from "@/lib/contacto";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TareaFormDialog } from "@/components/tareas/tarea-form-dialog";
import { TareaLista } from "@/components/tareas/tarea-lista";
import { COTIZACION_STATUS_COLOR, COTIZACION_STATUS_ICON } from "@/lib/status-colors";

// Esta lista no es solo prospectos nuevos -- también entra un cliente
// que YA es cliente pero está negociando un servicio adicional (tiene
// una cotización Enviada/Firmada todavía sin convertir a servicio). Es
// un embudo de venta de verdad: no importa si es la primera vez que
// habla contigo o la quinta. Sin tabla nueva: sigue siendo el mismo
// Cliente + Cotización de siempre. El status que se muestra es el de
// su cotización más reciente (mismo embudo Enviada→Firmada→Pagada/
// Vencida/Perdida de Cotizaciones); sin ninguna, se ve "Sin propuesta".
// El seguimiento se agenda como una Tarea normal ligada a este cliente
// -- mismo tablero de /admin/tareas, solo que aquí se ve de un vistazo.
export default async function ProspectosPage() {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, "Clientes");
  if (!permisos.puedeVer) redirect("/admin");

  const [prospectos, usuarios] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        OR: [
          { etiqueta: "Prospecto" },
          { cotizaciones: { some: { status: { in: ["Enviada", "Firmada"] }, servicioId: null } } },
          // Un cliente de siempre al que le pusiste un recordatorio de
          // seguimiento (desde su ficha) también cuenta como "en el
          // embudo" -- no hace falta ni cotización ni la etiqueta
          // Prospecto para eso.
          { tareas: { some: { completada: false } } },
        ],
      },
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
          {prospectos.length} en el embudo — nuevos etiquetados &quot;Prospecto&quot;, clientes con
          una propuesta activa sin cerrar, y cualquier cliente con un recordatorio de seguimiento
          pendiente
        </p>
      </div>

      {prospectos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nadie en el embudo ahora mismo. Etiqueta un cliente como &quot;Prospecto&quot;,
            envíale una cotización, o agrégale un recordatorio de seguimiento desde su ficha (en
            Clientes), para que aparezca aquí.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {prospectos.map((p) => {
            const cotizacion = p.cotizaciones[0];
            const Icono = cotizacion ? COTIZACION_STATUS_ICON[cotizacion.status] : null;
            const whatsapp = p.telefono ? whatsappHref(p.telefono) : null;

            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/clientes/${p.id}`} className="font-semibold hover:underline">
                        {p.nombre}
                      </Link>
                      {p.etiqueta !== "Prospecto" && (
                        <Badge variant="outline" className="text-[10px]">
                          Cliente existente
                        </Badge>
                      )}
                    </div>
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
