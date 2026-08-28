import type { ModuloSistema } from "@/generated/prisma/client";

// Módulos que sí se pueden otorgar a un usuario interno desde Usuarios y
// Accesos. "Usuarios" y "Portal" existen como valores de ModuloSistema
// (por si algún registro viejo los referencia) pero a propósito NO están
// aquí: ninguna página los consulta con permisosModulo() — Usuarios y
// Accesos es exclusivamente de Admin (esAdmin(), ver alcance.ts) y nunca
// se volvió a construir la pantalla que habría consultado "Portal".
// Mostrarlos como si fueran otorgables era engañoso: el admin podía
// marcar "Usuarios: Editar" para alguien y no pasaba absolutamente nada.
export const MODULOS: ModuloSistema[] = [
  "Clientes",
  "Servicios",
  "Cotizaciones",
  "Pagos",
  "Productos",
  "Ventas",
  "Quejas",
  "Tareas",
  "Intermediarios",
  "Portafolio",
];

export const MODULO_LABEL: Record<ModuloSistema, string> = {
  Clientes: "Clientes",
  Servicios: "Servicios",
  Cotizaciones: "Cotizaciones",
  Pagos: "Pagos",
  Productos: "Productos",
  Ventas: "Ventas",
  Quejas: "Quejas / Help Desk",
  Tareas: "Tareas",
  Intermediarios: "Intermediarios",
  Portafolio: "Portafolio",
  Usuarios: "Usuarios y Accesos",
  Portal: "Portal del cliente",
};
