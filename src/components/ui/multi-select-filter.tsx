"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// A partir de cuántas opciones vale la pena mostrar el buscador -- listas
// cortas (como Status) no lo necesitan y solo estorbarían.
const MIN_OPCIONES_PARA_BUSCAR = 6;

export function MultiSelectFilter({
  name,
  label,
  options,
  defaultSelected,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const buscable = options.length > MIN_OPCIONES_PARA_BUSCAR;

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  const opcionesFiltradas =
    buscable && search.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
      : options;

  const resumen =
    selected.length === 0
      ? `Todos`
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${selected.length} seleccionados`;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <Popover onOpenChange={(open) => !open && setSearch("")}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-between font-normal"
          >
            <span className="truncate">{resumen}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          onOpenAutoFocus={(e) => {
            if (buscable) {
              e.preventDefault();
              searchRef.current?.focus();
            }
          }}
        >
          {buscable && (
            <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1">
            {opcionesFiltradas.length === 0 ? (
              <p className="px-1.5 py-1 text-xs text-muted-foreground">
                {options.length === 0 ? "Sin opciones." : "Sin resultados."}
              </p>
            ) : (
              opcionesFiltradas.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm outline-hidden hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {selected.includes(o.value) && <Check className="size-3.5" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
