import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcularAvance } from "@/lib/servicio";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuejaFormDialog } from "@/components/quejas/queja-form-dialog";
import { QuejaDetalleDialog } from "@/components/quejas/queja-detalle-dialog";
import { crearQuejaPortal } from "@/app/portal/actions";

const STATUS_SERVICIO_LABEL: Record<string, string> = {
  Cotizado: "Cotizado",
  Aprobado: "Aprobado",
  EnProceso: "En proceso",
  Entregado: "Entregado",
  Cancelado: "Cancelado",
};

const STATUS_COTIZACION_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Enviada: "outline",
  Firmada: "default",
  Pagada: "secondary",
  Vencida: "destructive",
  Perdida: "destructive",
};

const STATUS_QUEJA_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Nueva: "outline",
  EnRevision: "default",
  Resuelta: "secondary",
  Cerrada: "secondary",
};

export default async function PortalPage() {
  const session = await auth();
  const clienteId = Number(session!.user.id);

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      servicios: { orderBy: { creadoEn: "desc" }, include: { tareas: true } },
      cotizaciones: {
        where: { status: { in: ["Enviada", "Firmada"] } },
        orderBy: { fechaEmision: "desc" },
      },
      quejas: {
        orderBy: { creadoEn: "desc" },
        include: { servicio: true },
      },
    },
  });

  if (!cliente) {
    return <p className="text-sm text-muted-foreground">No se encontró tu información.</p>;
  }

  const clienteFijoOpcion = {
    id: cliente.id,
    nombre: cliente.nombre,
    servicios: cliente.servicios.map((s) => ({ id: s.id, descripcion: s.descripcion })),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {cliente.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          Aquí puedes ver el avance de tus proyectos, tus cotizaciones y levantar soporte.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Mis proyectos ({cliente.servicios.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cliente.servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes proyectos activos.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {cliente.servicios.map((s) => {
                const { porcentaje } = calcularAvance(s.tareas);
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-lg border border-input p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{s.descripcion}</p>
                        <Badge variant="outline">
                          {STATUS_SERVICIO_LABEL[s.status] ?? s.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Avance: {porcentaje}%</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/servicio/${s.tokenPublico}`}>Ver detalle</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Mis cotizaciones ({cliente.cotizaciones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cliente.cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes cotizaciones pendientes.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {cliente.cotizaciones.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg border border-input p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{c.descripcion ?? `Cotización #${c.id}`}</p>
                      <Badge variant={STATUS_COTIZACION_VARIANT[c.status] ?? "outline"}>
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(c.montoTotal)}
                      {c.fechaVencimiento ? ` — vence ${formatDate(c.fechaVencimiento)}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/cotizacion/${c.token}`}>Ver y firmar</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Mis quejas / soporte ({cliente.quejas.length})
          </CardTitle>
          <QuejaFormDialog
            triggerLabel="Nueva queja"
            title="Reportar una queja"
            description="Cuéntanos qué pasó y le daremos seguimiento lo antes posible."
            action={crearQuejaPortal}
            clienteFijo={clienteFijoOpcion}
          />
        </CardHeader>
        <CardContent>
          {cliente.quejas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No has reportado ninguna queja.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {cliente.quejas.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-input p-3 text-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{q.categoria}</span>
                      <Badge variant={STATUS_QUEJA_VARIANT[q.status] ?? "outline"}>
                        {q.status}
                      </Badge>
                    </div>
                    <p className="max-w-md truncate text-xs text-muted-foreground">
                      {q.descripcion}
                    </p>
                  </div>
                  <QuejaDetalleDialog queja={{ ...q, cliente: { nombre: cliente.nombre } }} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
