"use client";

import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ImagenFormState } from "@/app/admin/portafolio/actions";

export function ImagenForm({
  proyectoId,
  action,
}: {
  proyectoId: number;
  action: (prevState: ImagenFormState, formData: FormData) => Promise<ImagenFormState>;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<{ url: string; nombre: string; tamanioBytes: number } | null>(
    null
  );

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorSubida(null);
    setArchivo(null);
    setSubiendo(true);
    setProgreso(0);

    try {
      const pathname = `portafolio/proyecto-${proyectoId}/${Date.now()}-${file.name}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/portafolio/upload",
        onUploadProgress: ({ percentage }) => setProgreso(percentage),
      });
      setArchivo({ url: blob.url, nombre: file.name, tamanioBytes: file.size });
    } catch (err) {
      setErrorSubida(
        err instanceof Error ? err.message : "No se pudo subir la imagen. Intenta de nuevo."
      );
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-input p-3">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="imagenFile">
          Captura o imagen del proyecto{" "}
          <span className="font-normal text-muted-foreground">(máx. 20 MB, entre más definida mejor)</span>
        </Label>
        <Input id="imagenFile" type="file" accept="image/*" onChange={onFileChange} disabled={subiendo} />

        {subiendo && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UploadCloud className="size-3.5 shrink-0 animate-pulse" />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(5, progreso)}%` }}
              />
            </div>
            <span className="shrink-0 tabular-nums">{Math.round(progreso)}%</span>
          </div>
        )}

        {errorSubida && <p className="text-xs text-destructive">{errorSubida}</p>}
        {archivo && !subiendo && (
          <p className="text-xs text-muted-foreground">✓ {archivo.nombre} listo para guardar</p>
        )}

        <input type="hidden" name="archivoUrl" value={archivo?.url ?? ""} />
        <input type="hidden" name="nombre" value={archivo?.nombre ?? ""} />
        <input type="hidden" name="tamanioBytes" value={archivo?.tamanioBytes ?? ""} />
      </div>

      <Button type="submit" size="sm" disabled={isPending || subiendo || !archivo} className="self-start">
        {isPending ? "Guardando..." : "Agregar al carrusel"}
      </Button>
    </form>
  );
}
