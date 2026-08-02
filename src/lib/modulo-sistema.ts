import type { ModuloSistema } from "@/generated/prisma/client";

export const MODULOS: ModuloSistema[] = [
  "Clientes",
  "Servicios",
  "Cotizaciones",
  "Pagos",
  "Productos",
  "Ventas",
  "Quejas",
  "Usuarios",
  "Portal",
];

export const MODULO_LABEL: Record<ModuloSistema, string> = {
  Clientes: "Clientes",
  Servicios: "Servicios",
  Cotizaciones: "Cotizaciones",
  Pagos: "Pagos",
  Productos: "Productos",
  Ventas: "Ventas",
  Quejas: "Quejas / Help Desk",
  Usuarios: "Usuarios y Accesos",
  Portal: "Portal del cliente",
};
