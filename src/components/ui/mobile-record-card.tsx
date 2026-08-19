import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Fila de lista estilo app móvil (tipo vista "Deck" de AppSheet): avatar
 * circular + título + subtítulo + badge, tocable. Se usa SOLO en el bloque
 * `md:hidden` de cada módulo — el listado de escritorio sigue siendo la
 * <Table> de siempre.
 *
 * Dos modos:
 * - `href` presente: toda la tarjeta es un Link a la página de detalle
 *   (Clientes, Servicios, Cotizaciones), con chevron al final.
 * - `href` ausente + `actions`: la tarjeta no navega a ningún lado — los
 *   módulos sin página de detalle (Pagos, Gastos, Quejas, Ventas...) ya
 *   resuelven todo con diálogos/botones inline, así que esos mismos
 *   controles se reutilizan tal cual en una barra de acciones al pie.
 */
export function MobileRecordCard({
  href,
  avatarLabel,
  avatarClassName,
  title,
  subtitle,
  meta,
  badge,
  actions,
}: {
  href?: string;
  avatarLabel: React.ReactNode;
  avatarClassName?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const avatar = (
    <div
      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        avatarClassName ?? "bg-blue-600/10 text-blue-600 dark:text-blue-400"
      }`}
    >
      {avatarLabel}
    </div>
  );

  const info = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium">{title}</p>
        {badge}
      </div>
      {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-transform active:scale-[0.98] active:bg-muted/60"
      >
        {avatar}
        {info}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {avatar}
        {info}
      </div>
      {actions && (
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
          {actions}
        </div>
      )}
    </div>
  );
}
