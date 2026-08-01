"use client";

import { useActionState, useState } from "react";

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

export function EvidenciaForm({
  action,
}: {
  action: (
    prevState: EvidenciaFormState,
    formData: FormData
  ) => Promise<EvidenciaFormState>;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [tipo, setTipo] = useState<"imagen" | "video">("imagen");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-input p-3">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipoEvidencia">Tipo</Label>
          <Select
            name="tipoEvidencia"
            value={tipo}
            onValueChange={(v) => setTipo(v as "imagen" | "video")}
          >
            <SelectTrigger id="tipoEvidencia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="imagen">Imagen</SelectItem>
              <SelectItem value="video">Liga de video (Loom, Drive, YouTube...)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="titulo">Título (opcional)</Label>
          <Input id="titulo" name="titulo" placeholder="Ej. Avance semana 3" />
        </div>
      </div>

      {tipo === "imagen" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="imagenFile">Imagen *</Label>
          <Input id="imagenFile" type="file" accept="image/*" onChange={onFileChange} />
          {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
          <input type="hidden" name="imagen" value={dataUrl ?? ""} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="videoUrl">Liga del video *</Label>
          <Input
            id="videoUrl"
            name="videoUrl"
            type="url"
            placeholder="https://..."
          />
        </div>
      )}

      <Button
        type="submit"
        size="sm"
        disabled={isPending || (tipo === "imagen" && !dataUrl)}
        className="self-start"
      >
        {isPending ? "Subiendo..." : "Subir evidencia"}
      </Button>
    </form>
  );
}
