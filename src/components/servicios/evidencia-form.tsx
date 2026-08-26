"use client";

import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EvidenciaFormState } from "@/app/admin/servicios/actions";

type Tipo = "imagen" | "video-archivo" | "video-liga";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenciaForm({
  servicioId,
  action,
}: {
  servicioId: number;
  action: (
    prevState: EvidenciaFormState,
    formData: FormData
  ) => Promise<EvidenciaFormState>;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [tipo, setTipo] = useState<Tipo>("imagen");
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
      const esVideo = tipo === "video-archivo";
      const carpeta = esVideo ? "video" : "imagen";
      const pathname = `evidencia/servicio-${servicioId}/${carpeta}-${Date.now()}-${file.name}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/servicios/evidencia/upload",
        clientPayload: JSON.stringify({ servicioId, tipo: esVideo ? "video" : "imagen" }),
        onUploadProgress: ({ percentage }) => setProgreso(percentage),
      });

      setArchivo({ url: blob.url, nombre: file.name, tamanioBytes: file.size });
    } catch (err) {
      setErrorSubida(
        err instanceof Error ? err.message : "No se pudo subir el archivo. Intenta de nuevo."
      );
    } finally {
      setSubiendo(false);
      // Deja el input reseteable para volver a elegir el mismo archivo si algo falló.
      e.target.value = "";
    }
  }

  function onTipoChange(v: Tipo) {
    setTipo(v);
    setArchivo(null);
    setErrorSubida(null);
  }

  const puedeEnviar =
    !isPending &&
    !subiendo &&
    (tipo === "video-liga" ? true : archivo !== null);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // Limpia el archivo ya registrado para el próximo formulario, una
        // vez que el submit ya tomó los valores actuales de los inputs.
        setTimeout(() => setArchivo(null), 0);
      }}
      className="flex flex-col gap-3 rounded-lg border border-input p-3"
    >
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipoEvidencia">Tipo</Label>
          <Select name="tipoEvidencia" value={tipo} onValueChange={(v) => onTipoChange(v as Tipo)}>
            <SelectTrigger id="tipoEvidencia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="imagen">Imagen</SelectItem>
              <SelectItem value="video-archivo">Video (subir archivo)</SelectItem>
              <SelectItem value="video-liga">Video (liga de Loom, Drive, YouTube...)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="titulo">Título (opcional)</Label>
          <Input id="titulo" name="titulo" placeholder="Ej. Avance semana 3" />
        </div>
      </div>

      {tipo === "video-liga" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="videoUrl">Liga del video *</Label>
          <Input id="videoUrl" name="videoUrl" type="url" placeholder="https://..." />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="archivoFile">
            {tipo === "imagen" ? "Imagen *" : "Video *"}{" "}
            <span className="font-normal text-muted-foreground">
              (máx. {tipo === "imagen" ? "20 MB" : "300 MB"})
            </span>
          </Label>
          <Input
            id="archivoFile"
            type="file"
            accept={tipo === "imagen" ? "image/*" : "video/*"}
            onChange={onFileChange}
            disabled={subiendo}
          />

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
            <p className="text-xs text-muted-foreground">
              ✓ {archivo.nombre} · {formatBytes(archivo.tamanioBytes)}
            </p>
          )}

          <input type="hidden" name="archivoUrl" value={archivo?.url ?? ""} />
          <input type="hidden" name="tamanioBytes" value={archivo?.tamanioBytes ?? ""} />
        </div>
      )}

      <Button type="submit" size="sm" disabled={!puedeEnviar} className="self-start">
        {isPending ? "Guardando..." : "Subir evidencia"}
      </Button>
    </form>
  );
}
