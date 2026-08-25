import type { ComponentType } from "react";
import {
  FileText,
  CheckCircle2,
  Loader,
  PackageCheck,
  XCircle,
  Send,
  FileSignature,
  Clock,
  AlertCircle,
  Eye,
  Archive,
  Building2,
  User,
  Code2,
  Package,
  ShoppingBag,
  Handshake,
} from "lucide-react";

// Colores/íconos por status, centralizados aquí para que el significado de
// cada color sea el mismo sin importar si se ve en una lista, una tarjeta
// móvil o una página de detalle — antes cada archivo tenía su propia copia
// y podían desincronizarse entre sí.

type IconMap = Record<string, ComponentType<{ className?: string }>>;

export const ACTIVO_COLOR = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
export const INACTIVO_COLOR = "bg-slate-500/15 text-slate-700 dark:text-slate-300";
export const CONFIRMADO_COLOR = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
export const PENDIENTE_COLOR = "bg-amber-500/15 text-amber-700 dark:text-amber-400";

export const SERVICIO_STATUS_COLOR: Record<string, string> = {
  Cotizado: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  Aprobado: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  EnProceso: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Entregado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Cancelado: "bg-red-500/15 text-red-700 dark:text-red-400",
};
export const SERVICIO_STATUS_ICON: IconMap = {
  Cotizado: FileText,
  Aprobado: CheckCircle2,
  EnProceso: Loader,
  Entregado: PackageCheck,
  Cancelado: XCircle,
};

export const COTIZACION_STATUS_COLOR: Record<string, string> = {
  Enviada: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Firmada: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  Pagada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Vencida: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Perdida: "bg-red-500/15 text-red-700 dark:text-red-400",
};
export const COTIZACION_STATUS_ICON: IconMap = {
  Enviada: Send,
  Firmada: FileSignature,
  Pagada: CheckCircle2,
  Vencida: Clock,
  Perdida: XCircle,
};

export const ORDEN_STATUS_COLOR: Record<string, string> = {
  Pendiente: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Aprobada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Rechazada: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const QUEJA_STATUS_COLOR: Record<string, string> = {
  Nueva: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  EnRevision: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Resuelta: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Cerrada: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};
export const QUEJA_STATUS_ICON: IconMap = {
  Nueva: AlertCircle,
  EnRevision: Eye,
  Resuelta: CheckCircle2,
  Cerrada: Archive,
};

export const PRODUCTO_CATEGORIA_COLOR: Record<string, string> = {
  Plantilla: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Sistema: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  Otro: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};
export const PRODUCTO_CATEGORIA_ICON: IconMap = {
  Plantilla: FileText,
  Sistema: Code2,
  Otro: Package,
};

export const VENTA_ORIGEN_COLOR: Record<string, string> = {
  TiendaOnline: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Manual: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};
export const VENTA_ORIGEN_ICON: IconMap = {
  TiendaOnline: ShoppingBag,
  Manual: Handshake,
};

export const GASTO_AMBITO_COLOR: Record<string, string> = {
  Empresa: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Personal: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};
export const GASTO_AMBITO_ICON: IconMap = {
  Empresa: Building2,
  Personal: User,
};

export const TIPO_CUENTA_COLOR: Record<string, string> = {
  Banco: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Efectivo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Billetera: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

export const USUARIO_ROL_COLOR: Record<string, string> = {
  Admin: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  Interno: "bg-primary/10 text-primary",
};

export const PRIORIDAD_COLOR: Record<string, string> = {
  Alta: "bg-red-500/15 text-red-700 dark:text-red-400",
  Media: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  Baja: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};
export const PRIORIDAD_BAR: Record<string, string> = {
  Alta: "bg-red-500",
  Media: "bg-orange-500",
  Baja: "bg-emerald-500",
};

export const CLIENTE_ETIQUETA_COLOR: Record<string, string> = {
  VIP: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Premium: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  Platinum: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  Prospecto: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};
