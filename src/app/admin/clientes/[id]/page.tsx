import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { montoTotalServicio } from "@/lib/servicio";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentUsuario } from "@/lib/current-usuario";
import { puedeVerTodo } from "@/lib/alcance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { PortalAccessCard } from "@/components/clientes/portal-access-card";
import { QuejaFormDialog } from "@/components/quejas/queja-form-dialog";
import { QuejaDetalleDialog } from "@/components/quejas/queja-detalle-dialog";
import {
  desactivarPortalCliente,
  guardarPasswordPortalCliente,
  updateCliente,
} from "@/app/admin/clientes/actions";
import { actualizarQueja, crearQueja } from "@/app/admin/quejas/actions";

const STATUS_SERVICIO_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Cotizado: "outline",
  Aprobado: "secondary",
  EnProceso: "default",
  Entregado: "secondary",
  Cancelado: "destructive",
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clienteId = Number(id);

  const cliente = clienteId
    ? await prisma.cliente.findUnique({
        where: { id: clienteId },
        include: {
          servicios: {
            orderBy: { creadoEn: "desc" },
            include: {
              ordenesCambio: true,
              pagos: true,
              cotizaciones: true,
              intermediario: true,
            },
          },
          quejas: { orderBy: { creadoEn: "desc" }, include: { servicio: true } },
        },
      })
    : null;

  if (!cliente) notFound();

  const usuarioActual = await currentUsuario();
  const verTodoClientes = await puedeVerTodo(usuarioActual, "Clientes");
  const esPropio =
    verTodoClientes ||
    cliente.servicios.some((s) => s.responsableId === usuarioActual?.id);

  if (!esPropio) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{cliente.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            No tienes servicios asignados de este cliente — solo puedes ver su nombre.
          </p>
        </div>
      </div>
    );
  }

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const clienteFijoOpcion = {
    id: cliente.id,
    nombre: cliente.nombre,
    servicios: cliente.servicios.map((s) => ({ id: s.id, descripcion: s.descripcion })),
  };

  const totalServicios = cliente.servicios.length;
  const serviciosActivos = cliente.servicios.filter((s) =>
    ["Aprobado", "EnProceso"].includes(s.status)
  ).length;
  const montoTotalFacturado = cliente.servicios.reduce(
    (acc, s) => acc + montoTotalServicio(s),
    0
  );

  const pagos = cliente.servicios.flatMap((s) =>
    s.pagos.map((p) => ({ ...p, servicioDescripcion: s.descripcion }))
  );
  const montoTotalPagado = pagos
    .filter((p) => p.confirmado)
    .reduce((acc, p) => acc + Number(p.monto), 0);

  const cotizaciones = cliente.servicios.flatMap((s) =>
    s.cotizaciones.map((c) => ({ ...c, servicioDescripcion: s.descripcion }))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{cliente.nombre}</h1>
            {cliente.etiqueta && (
              <Badge variant="outline">{cliente.etiqueta}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Cliente desde {formatDate(cliente.creadoEn)}
          </p>
        </div>
        <ClienteFormDialog
          trigger={
            <Button variant="outline">
              <Pencil />
              Editar
            </Button>
          }
          title="Editar cliente"
          description={cliente.nombre}
          action={updateCliente.bind(null, cliente.id)}
          defaultValues={cliente}
          submitLabel="Guardar cambios"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total de trabajos" value={String(totalServicios)} />
        <Kpi label="Servicios activos" value={String(serviciosActivos)} />
        <Kpi label="Total facturado" value={formatCurrency(montoTotalFacturado)} />
        <Kpi label="Total pagado" value={formatCurrency(montoTotalPagado)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Datos de contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-muted-foreground">País</p>
            <p>{cliente.pais ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Teléfono</p>
            <p>{cliente.telefono ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p>{cliente.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Medio de captación</p>
            <p>{cliente.medioCaptacion ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Código de referido</p>
            <p>{cliente.codigoReferido ?? "—"}</p>
          </div>
          {cliente.notas && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-muted-foreground">Notas</p>
              <p className="whitespace-pre-wrap">{cliente.notas}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PortalAccessCard
        email={cliente.email}
        portalActivo={cliente.portalActivo}
        ultimoAcceso={cliente.ultimoAccesoPortal ? formatDate(cliente.ultimoAccesoPortal) : null}
        guardarPassword={guardarPasswordPortalCliente.bind(null, cliente.id)}
        desactivar={desactivarPortalCliente.bind(null, cliente.id)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Servicios / trabajos ({totalServicios})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cliente.servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente aún no tiene servicios registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Intermediario</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cliente.servicios.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/servicios/${s.id}`} className="hover:underline">
                        {s.descripcion}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_SERVICIO_VARIANT[s.status] ?? "outline"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.intermediario?.nombre ?? "—"}</TableCell>
                    <TableCell>{formatDate(s.fechaInicio)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(montoTotalServicio(s))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Cotizaciones ({cotizaciones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente aún no tiene cotizaciones.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizaciones.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/cotizaciones/${c.id}`} className="hover:underline">
                        {c.servicioDescripcion}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(c.fechaEmision)}</TableCell>
                    <TableCell>{formatDate(c.fechaVencimiento)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.montoTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Pagos ({pagos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente aún no tiene pagos registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.servicioDescripcion}
                    </TableCell>
                    <TableCell>{formatDate(p.fecha)}</TableCell>
                    <TableCell>{p.metodoPago}</TableCell>
                    <TableCell>
                      <Badge variant={p.confirmado ? "secondary" : "outline"}>
                        {p.confirmado ? "Confirmado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.monto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Quejas ({cliente.quejas.length})
          </CardTitle>
          <QuejaFormDialog action={crearQueja} clienteFijo={clienteFijoOpcion} />
        </CardHeader>
        <CardContent>
          {cliente.quejas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente no ha registrado quejas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cliente.quejas.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>{q.categoria}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {q.descripcion}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{q.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(q.creadoEn)}</TableCell>
                    <TableCell>
                      <QuejaDetalleDialog
                        queja={{
                          id: q.id,
                          categoria: q.categoria,
                          descripcion: q.descripcion,
                          status: q.status,
                          respuesta: q.respuesta,
                          creadoEn: q.creadoEn,
                          respondidoEn: q.respondidoEn,
                          cliente: { nombre: cliente.nombre },
                          servicio: q.servicio ? { descripcion: q.servicio.descripcion } : null,
                          asignadoAId: q.asignadoAId,
                        }}
                        action={actualizarQueja.bind(null, q.id)}
                        usuarios={usuarios}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
