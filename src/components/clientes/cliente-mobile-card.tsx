import Link from "next/link";
import { ChevronRight, Mail, MessageCircle, Lock } from "lucide-react";

import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { whatsappHref, mailtoHref } from "@/lib/contacto";
import { CLIENTE_ETIQUETA_COLOR } from "@/lib/status-colors";
import type { Etiqueta } from "@/generated/prisma/client";

const AVATAR_DEFAULT = "bg-primary/10 text-primary";

/** Tarjeta de cliente para el listado móvil -- va más allá de
 * `MobileRecordCard` (que es genérica para varios módulos) porque aquí sí
 * necesitamos estado de cuenta y accesos rápidos de contacto dentro de la
 * misma tarjeta, como en el rediseño. Vive junto a Clientes en vez de en
 * `components/ui` porque ningún otro módulo necesita esta forma. */
export function ClienteMobileCard({
  cliente,
  esPropio,
  serviciosActivos,
  facturado,
  saldo,
  ultimaActividad,
}: {
  cliente: {
    id: number;
    nombre: string;
    etiqueta: Etiqueta | null;
    pais: string | null;
    medioCaptacion: string | null;
    email: string | null;
    telefono: string | null;
  };
  esPropio: boolean;
  serviciosActivos: number;
  facturado: number;
  saldo: number;
  ultimaActividad: Date;
}) {
  const inicial = cliente.nombre.trim().charAt(0).toUpperCase() || "?";
  const colorEtiqueta = cliente.etiqueta ? CLIENTE_ETIQUETA_COLOR[cliente.etiqueta] : undefined;

  if (!esPropio) {
    return (
      <Link
        href={`/admin/clientes/${cliente.id}`}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 opacity-75 shadow-sm"
      >
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorEtiqueta ?? AVATAR_DEFAULT}`}
        >
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{cliente.nombre}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Lock className="size-3" />
            Datos restringidos
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <Link href={`/admin/clientes/${cliente.id}`} className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorEtiqueta ?? AVATAR_DEFAULT}`}
        >
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-medium">{cliente.nombre}</p>
            {cliente.etiqueta && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLIENTE_ETIQUETA_COLOR[cliente.etiqueta]}`}
              >
                {cliente.etiqueta}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[cliente.pais, cliente.medioCaptacion, `${serviciosActivos} servicio${serviciosActivos === 1 ? "" : "s"} activo${serviciosActivos === 1 ? "" : "s"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </Link>

      <div className="mt-3 flex items-center gap-3.5 border-t border-border pt-2.5">
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Facturado</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCurrency(facturado)}</p>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Saldo</p>
          <p
            className={`mt-0.5 text-sm font-semibold tabular-nums ${saldo > 0 ? "text-destructive" : "text-success"}`}
          >
            {saldo > 0 ? formatCurrency(saldo) : "Al día"}
          </p>
        </div>
        <div className="flex gap-2">
          {cliente.telefono && (
            <a
              href={whatsappHref(cliente.telefono)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp a ${cliente.nombre}`}
              className="flex size-10 items-center justify-center rounded-xl bg-success/15 text-success"
            >
              <MessageCircle className="size-4.5" />
            </a>
          )}
          {cliente.email && (
            <a
              href={mailtoHref(cliente.email)}
              aria-label={`Correo a ${cliente.nombre}`}
              className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"
            >
              <Mail className="size-4.5" />
            </a>
          )}
        </div>
      </div>

      <p className="mt-2.5 text-[11px] text-muted-foreground">
        Última actividad {formatRelativeDate(ultimaActividad)}
      </p>
    </div>
  );
}
