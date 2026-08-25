import { prisma } from "@/lib/prisma";
import { currentUsuario } from "@/lib/current-usuario";
import type { ModuloSistema, NivelPermiso, Usuario } from "@/generated/prisma/client";

const RANGO: Record<NivelPermiso, number> = { Ver: 1, Crear: 2, Editar: 3 };

export function esAdmin(usuario: Pick<Usuario, "rol"> | null | undefined) {
  return usuario?.rol === "Admin";
}

export type PermisoModulo = {
  puedeVer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  verTodo: boolean;
};

const SIN_ACCESO: PermisoModulo = {
  puedeVer: false,
  puedeCrear: false,
  puedeEditar: false,
  verTodo: false,
};

export async function permisosModulo(
  usuario: Pick<Usuario, "id" | "rol"> | null | undefined,
  modulo: ModuloSistema
): Promise<PermisoModulo> {
  if (esAdmin(usuario)) return { puedeVer: true, puedeCrear: true, puedeEditar: true, verTodo: true };
  if (!usuario) return SIN_ACCESO;

  const permiso = await prisma.moduloPermiso.findUnique({
    where: { usuarioId_modulo: { usuarioId: usuario.id, modulo } },
  });
  if (!permiso) return SIN_ACCESO;

  const rango = RANGO[permiso.nivel];
  return {
    puedeVer: rango >= RANGO.Ver,
    puedeCrear: rango >= RANGO.Crear,
    puedeEditar: rango >= RANGO.Editar,
    verTodo: permiso.alcance === "Todo",
  };
}

export async function requiereNivel(
  modulo: ModuloSistema,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, modulo);
  return minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
}

// Para módulos que son exclusivos del dueño del negocio y nunca deben
// poder otorgarse a un usuario interno normal (Reportes, Gastos) — a
// diferencia de requiereNivel(), esto no consulta ModuloPermiso en
// absoluto: ni siquiera un Admin podría "graduar" a alguien más aquí
// desde Usuarios y Accesos, porque esos módulos no forman parte de
// ModuloSistema.
export async function requiereAdmin(): Promise<boolean> {
  const usuario = await currentUsuario();
  return esAdmin(usuario);
}

// --- Chequeos de alcance por registro -------------------------------------
// requiereNivel() solo verifica nivel (Ver/Crear/Editar) — un usuario con
// alcance "Propio" que apenas tiene permiso de Editar en el módulo podía
// editar CUALQUIER registro con solo conocer su id, sin importar que las
// páginas de listado/detalle sí filtren lo que se le muestra. Estas
// funciones repiten el mismo criterio de "es mío" que ya usan las páginas,
// pero del lado de la acción — para que manipular el id a mano no sirva de
// nada si el registro no le pertenece.

async function usuarioYPermisos(modulo: ModuloSistema) {
  const usuario = await currentUsuario();
  const permisos = await permisosModulo(usuario, modulo);
  return { usuario, permisos };
}

// Criterio compartido por varios módulos: "¿el usuario tiene nivel Y (el
// servicio en cuestión es suyo, o de plano ve todo)?" — lo usan tanto
// acciones sobre un Servicio existente como acciones de otros módulos
// (Pagos, Cotizaciones) que cuelgan de un servicio y deben respetar el
// mismo dueño.
async function puedeOperarServicioEnModulo(
  modulo: ModuloSistema,
  servicioId: number,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const { usuario, permisos } = await usuarioYPermisos(modulo);
  const tieneNivel = minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
  if (!tieneNivel) return false;
  if (permisos.verTodo) return true;
  if (!usuario) return false;

  const servicio = await prisma.servicio.findUnique({
    where: { id: servicioId },
    select: { responsableId: true },
  });
  return !!servicio && servicio.responsableId === usuario.id;
}

export async function requiereNivelServicio(
  servicioId: number,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  return puedeOperarServicioEnModulo("Servicios", servicioId, minimo);
}

// Un Pago siempre cuelga de un Servicio (servicioId es obligatorio) — el
// alcance "Propio" en Pagos se hereda del responsable de ese servicio,
// igual que ya pasa con Quejas.
export async function requiereNivelPago(
  pagoId: number,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const { usuario, permisos } = await usuarioYPermisos("Pagos");
  const tieneNivel = minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
  if (!tieneNivel) return false;
  if (permisos.verTodo) return true;
  if (!usuario) return false;

  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    select: { servicio: { select: { responsableId: true } } },
  });
  return !!pago && pago.servicio.responsableId === usuario.id;
}

// Para crearPago (o mover un pago a otro servicio, o borrar un
// comprobante del que solo se conoce el servicio): todavía no hay un
// pagoId que consultar, pero ya se sabe a qué servicio corresponde —
// mismo criterio, verificado contra ese servicio directamente.
export async function requiereNivelPagoNuevo(
  servicioId: number,
  minimo: "Crear" | "Editar" = "Crear"
): Promise<boolean> {
  return puedeOperarServicioEnModulo("Pagos", servicioId, minimo);
}

// Una Cotización es "propia" si el usuario la creó (negociación suelta,
// sin servicio todavía) o si ya está colgada de un servicio del que es
// responsable.
export async function requiereNivelCotizacion(
  cotizacionId: number,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const { usuario, permisos } = await usuarioYPermisos("Cotizaciones");
  const tieneNivel = minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
  if (!tieneNivel) return false;
  if (permisos.verTodo) return true;
  if (!usuario) return false;

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: { creadoPorId: true, servicio: { select: { responsableId: true } } },
  });
  if (!cotizacion) return false;
  return cotizacion.creadoPorId === usuario.id || cotizacion.servicio?.responsableId === usuario.id;
}

// Para crearCotizacion cuando se vincula a un servicio existente: ese
// servicio ya tiene dueño, así que debe ser el usuario actual.
export async function requiereNivelCotizacionNuevaParaServicio(servicioId: number): Promise<boolean> {
  return puedeOperarServicioEnModulo("Cotizaciones", servicioId, "Crear");
}

export async function requiereNivelQueja(
  quejaId: number,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const { usuario, permisos } = await usuarioYPermisos("Quejas");
  const tieneNivel = minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
  if (!tieneNivel) return false;
  if (permisos.verTodo) return true;
  if (!usuario) return false;

  const queja = await prisma.queja.findUnique({
    where: { id: quejaId },
    select: { asignadoAId: true, servicio: { select: { responsableId: true } } },
  });
  if (!queja) return false;
  return queja.asignadoAId === usuario.id || queja.servicio?.responsableId === usuario.id;
}

export async function requiereNivelTarea(
  tareaId: number,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const { usuario, permisos } = await usuarioYPermisos("Tareas");
  const tieneNivel = minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
  if (!tieneNivel) return false;
  if (permisos.verTodo) return true;
  if (!usuario) return false;

  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    select: { asignadoAId: true },
  });
  return !!tarea && tarea.asignadoAId === usuario.id;
}

export async function requiereNivelCliente(
  clienteId: number,
  minimo: "Crear" | "Editar"
): Promise<boolean> {
  const { usuario, permisos } = await usuarioYPermisos("Clientes");
  const tieneNivel = minimo === "Crear" ? permisos.puedeCrear : permisos.puedeEditar;
  if (!tieneNivel) return false;
  if (permisos.verTodo) return true;
  if (!usuario) return false;

  const servicioPropio = await prisma.servicio.findFirst({
    where: { clienteId, responsableId: usuario.id },
    select: { id: true },
  });
  return !!servicioPropio;
}
