import { Plus, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import { esAdmin } from "@/lib/alcance";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { UsuarioFormDialog } from "@/components/usuarios/usuario-form-dialog";
import { PermisosDialog } from "@/components/usuarios/permisos-dialog";
import {
  AprobarTicketButton,
  RechazarTicketButton,
} from "@/components/usuarios/resolver-ticket-dialog";
import { actualizarUsuario, crearUsuario } from "@/app/admin/usuarios/actions";
import { MODULO_LABEL } from "@/lib/modulo-sistema";

export default async function UsuariosPage() {
  const usuarioActual = await currentUsuario();
  if (!esAdmin(usuarioActual)) redirect("/admin");

  const [usuarios, ticketsPendientes] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { creadoEn: "asc" },
      include: { moduloPermisos: true },
    }),
    prisma.ticketAcceso.findMany({
      where: { status: "Pendiente" },
      orderBy: { fechaSolicitud: "asc" },
      include: { usuarioSolicitante: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios y Accesos</h1>
          <p className="text-sm text-muted-foreground">
            {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"} registrado
            {usuarios.length === 1 ? "" : "s"}
          </p>
        </div>
        <UsuarioFormDialog
          trigger={
            <Button>
              <Plus />
              Nuevo usuario
            </Button>
          }
          title="Nuevo usuario"
          action={crearUsuario}
          submitLabel="Crear usuario"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tickets de acceso pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsPendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay tickets de acceso pendientes.</p>
          ) : (
            <>
              {/* Escritorio: tabla clásica */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-48" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticketsPendientes.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.usuarioSolicitante.nombre}</TableCell>
                      <TableCell>{MODULO_LABEL[t.moduloSolicitado]}</TableCell>
                      <TableCell className="max-w-64 truncate">{t.motivo}</TableCell>
                      <TableCell>{formatDate(t.fechaSolicitud)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <AprobarTicketButton ticketId={t.id} />
                          <RechazarTicketButton ticketId={t.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Móvil: tarjetas tipo app */}
              <div className="flex flex-col gap-2 md:hidden">
                {ticketsPendientes.map((t) => (
                  <MobileRecordCard
                    key={t.id}
                    avatarLabel={<ShieldCheck className="size-5" />}
                    avatarClassName="bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    title={t.usuarioSolicitante.nombre}
                    subtitle={`${MODULO_LABEL[t.moduloSolicitado]} · ${t.motivo}`}
                    meta={formatDate(t.fechaSolicitud)}
                    actions={
                      <>
                        <AprobarTicketButton ticketId={t.id} />
                        <RechazarTicketButton ticketId={t.id} />
                      </>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Escritorio: tabla clásica */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => {
                const permisos = Object.fromEntries(
                  u.moduloPermisos.map((p) => [p.modulo, p.nivel])
                );
                const alcances = Object.fromEntries(
                  u.moduloPermisos.map((p) => [p.modulo, p.alcance])
                );
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nombre}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.rol === "Admin" ? "default" : "outline"}>{u.rol}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.activo ? "secondary" : "outline"}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PermisosDialog
                        usuarioId={u.id}
                        permisos={permisos}
                        alcances={alcances}
                        trigger={
                          <Button size="sm" variant="outline">
                            <ShieldCheck className="size-4" />
                            {u.moduloPermisos.length} módulo{u.moduloPermisos.length === 1 ? "" : "s"}
                          </Button>
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <UsuarioFormDialog
                          trigger={
                            <Button size="icon" variant="ghost" className="size-7">
                              <Pencil className="size-4" />
                            </Button>
                          }
                          title="Editar usuario"
                          action={actualizarUsuario.bind(null, u.id)}
                          defaultValues={{
                            nombre: u.nombre,
                            email: u.email,
                            rol: u.rol,
                            activo: u.activo,
                          }}
                          submitLabel="Guardar cambios"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Móvil: tarjetas tipo app */}
          <div className="flex flex-col gap-2 md:hidden">
            {usuarios.map((u) => {
              const permisos = Object.fromEntries(u.moduloPermisos.map((p) => [p.modulo, p.nivel]));
              const alcances = Object.fromEntries(u.moduloPermisos.map((p) => [p.modulo, p.alcance]));
              return (
                <MobileRecordCard
                  key={u.id}
                  avatarLabel={u.nombre.trim().charAt(0).toUpperCase() || <UserRound className="size-5" />}
                  avatarClassName={
                    u.rol === "Admin"
                      ? "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                      : "bg-primary/10 text-primary"
                  }
                  title={u.nombre}
                  subtitle={u.email}
                  meta={u.rol}
                  badge={
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.activo
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  }
                  actions={
                    <>
                      <PermisosDialog
                        usuarioId={u.id}
                        permisos={permisos}
                        alcances={alcances}
                        trigger={
                          <Button size="sm" variant="outline">
                            <ShieldCheck className="size-4" />
                            {u.moduloPermisos.length} módulo{u.moduloPermisos.length === 1 ? "" : "s"}
                          </Button>
                        }
                      />
                      <UsuarioFormDialog
                        trigger={
                          <Button size="icon" variant="ghost" className="size-7">
                            <Pencil className="size-4" />
                          </Button>
                        }
                        title="Editar usuario"
                        action={actualizarUsuario.bind(null, u.id)}
                        defaultValues={{
                          nombre: u.nombre,
                          email: u.email,
                          rol: u.rol,
                          activo: u.activo,
                        }}
                        submitLabel="Guardar cambios"
                      />
                    </>
                  }
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
