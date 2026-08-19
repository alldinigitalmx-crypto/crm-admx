import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Fila de lista estilo app móvil (tipo vista "Deck"/tarjeta de AppSheet):
 * avatar circular + título + subtítulo + badge opcional, todo tocable.
 * Se usa SOLO en el bloque `md:hidden` de cada módulo — el listado de
 * escritorio sigue siendo la <Table> de siempre.
 */
export function MobileRecordCard({
  href,
  avatarLabel,
  avatarClassName,
  title,
  subtitle,
  meta,
  badge,
}: {
  href: string;
  avatarLabel: string;
  avatarClassName?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-transform active:scale-[0.98] active:bg-muted/60"
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          avatarClassName ?? "bg-blue-600/10 text-blue-600 dark:text-blue-400"
        }`}
      >
        {avatarLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium">{title}</p>
          {badge}
        </div>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}
