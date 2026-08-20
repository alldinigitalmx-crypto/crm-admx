"use client";

import { LogOut, Code2 } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function PortalTopbar({
  userName,
  onSignOut,
}: {
  userName?: string | null;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary">
          <Code2 className="size-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold tracking-wide">ADMX DEV</span>
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
        )}
        <ThemeToggle />
        <form action={onSignOut}>
          <Button type="submit" variant="ghost" size="icon" title="Cerrar sesión">
            <LogOut />
          </Button>
        </form>
      </div>
    </header>
  );
}
