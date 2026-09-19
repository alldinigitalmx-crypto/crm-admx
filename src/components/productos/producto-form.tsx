"use client";

import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductoFormState } from "@/app/admin/productos/actions";

type ArchivoActual = { url: string; nombre: string } | null;

export type ProductoDefaults = {
  nombre: string;
  descripcion: string | null;
  categoria: string;
  precio: number | string | { toString(): string };
  costoReferencia: (number | string | { toString(): string }) | null;
  requiereCotizacion: boolean;
  activo: boolean;
  tipoEntrega: string;
  linkAppSheet: string | null;
  linkTutorial: string | null;
  linkExterno: string | null;
  imagenActual: ArchivoActual;
  archivoActual: ArchivoActual;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SubidaState = { url: string; nombre: string; tamanioBytes: number } | null;

function SubidaArchivo({
  label,
  hint,
  accept,
  tipo,
  actual,
  campoUrl,
  campoNombre,
  campoTamanio,
}: {
  label: string;
  hint: string;
  accept?: string;
  tipo: "imagen" | "archivo";
  actual: ArchivoActual;
  campoUrl: string;
  campoNombre: string;
  campoTamanio: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<SubidaState>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setNuevo(null);
    setSubiendo(true);
    setProgreso(0);

    try {
      const pathname = `productos/${tipo}-${Date.now()}-${file.name}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/productos/upload",
        clientPayload: JSON.stringify({ tipo }),
        onUploadProgress: ({ percentage }) => setProgreso(percentage),
      });
      setNuevo({ url: blob.url, nombre: file.name, tamanioBytes: file.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo. Intenta de nuevo.");
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label} <span className="font-normal text-muted-foreground">{hint}</span>
      </Label>
      <Input type="file" accept={accept} onChange={onFileChange} disabled={subiendo} />

      {subiendo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UploadCloud className="size-3.5 shrink-0 animate-pulse" />
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(5, progreso)}%` }} />
          </div>
          <span className="shrink-0 tabular-nums">{Math.round(progreso)}%</span>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {nuevo && !subiendo && (
        <p className="text-xs text-muted-foreground">
          ✓ {nuevo.nombre} · {formatBytes(nuevo.tamanioBytes)} (reemplaza al actual al guardar)
        </p>
      )}
      {!nuevo && actual && !subiendo && (
        <p className="truncate text-xs text-muted-foreground">
          Actual:{" "}
          <a href={actual.url} target="_blank" rel="noopener noreferrer" className="underline">
            {actual.nombre}
          </a>
        </p>
      )}

      <input type="hidden" name={campoUrl} value={nuevo?.url ?? ""} />
      <input type="hidden" name={campoNombre} value={nuevo?.nombre ?? ""} />
      <input type="hidden" name={campoTamanio} value={nuevo?.tamanioBytes ?? ""} />
    </div>
  );
}

export function ProductoForm({
  action,
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prevState: ProductoFormState, formData: FormData) => Promise<ProductoFormState>;
  defaultValues?: ProductoDefaults;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const wrappedAction = async (prevState: ProductoFormState, formData: FormData) => {
    const result = await action(prevState, formData);
    if (!result?.error) onSuccess?.();
    return result;
  };
  const [state, formAction, isPending] = useActionState(wrappedAction, undefined);
  const [tipoEntrega, setTipoEntrega] = useState(defaultValues?.tipoEntrega ?? "ArchivoDescargable");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          defaultValue={defaultValues?.nombre ?? ""}
          placeholder="Ej. Plantilla de landing page"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={2}
          defaultValue={defaultValues?.descripcion ?? ""}
          placeholder="Opcional"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoria">Categoría</Label>
          <Select name="categoria" defaultValue={defaultValues?.categoria ?? "Plantilla"}>
            <SelectTrigger id="categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Plantilla">Plantilla</SelectItem>
              <SelectItem value="Sistema">Sistema</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="precio">Precio *</Label>
          <Input
            id="precio"
            name="precio"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaultValues?.precio ? String(defaultValues.precio) : ""}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="costoReferencia">Costo de referencia</Label>
          <Input
            id="costoReferencia"
            name="costoReferencia"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              defaultValues?.costoReferencia ? String(defaultValues.costoReferencia) : ""
            }
            placeholder="Opcional — para calcular margen"
          />
        </div>
      </div>

      <SubidaArchivo
        label="Foto del producto"
        hint="(máx. 20 MB — entre más definida mejor, es lo que ve el comprador en la tienda)"
        accept="image/*"
        tipo="imagen"
        actual={defaultValues?.imagenActual ?? null}
        campoUrl="imagenUrl"
        campoNombre="imagenNombre"
        campoTamanio="imagenTamanioBytes"
      />

      <div className="flex flex-col gap-3 rounded-lg border border-input p-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipoEntrega">Cómo se entrega tras pagar</Label>
          <Select name="tipoEntrega" value={tipoEntrega} onValueChange={setTipoEntrega}>
            <SelectTrigger id="tipoEntrega" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ArchivoDescargable">Archivo descargable (.xlsx, .exe...)</SelectItem>
              <SelectItem value="LinkAppSheet">Link de AppSheet + tutorial</SelectItem>
              <SelectItem value="LinkExterno">Otro link</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tipoEntrega === "ArchivoDescargable" && (
          <SubidaArchivo
            label="Archivo descargable"
            hint="(máx. 300 MB — la plantilla de Excel o el instalador .exe)"
            tipo="archivo"
            actual={defaultValues?.archivoActual ?? null}
            campoUrl="archivoUrl"
            campoNombre="archivoNombre"
            campoTamanio="archivoTamanioBytes"
          />
        )}

        {tipoEntrega === "LinkAppSheet" && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="linkAppSheet">Link de la plantilla de AppSheet *</Label>
              <Input
                id="linkAppSheet"
                name="linkAppSheet"
                type="url"
                defaultValue={defaultValues?.linkAppSheet ?? ""}
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="linkTutorial">Video de primeros pasos</Label>
              <Input
                id="linkTutorial"
                name="linkTutorial"
                type="url"
                defaultValue={defaultValues?.linkTutorial ?? ""}
                placeholder="Opcional — https://..."
              />
            </div>
          </>
        )}

        {tipoEntrega === "LinkExterno" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="linkExterno">Link *</Label>
            <Input
              id="linkExterno"
              name="linkExterno"
              type="url"
              defaultValue={defaultValues?.linkExterno ?? ""}
              placeholder="https://..."
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="requiereCotizacion"
            name="requiereCotizacion"
            defaultChecked={defaultValues?.requiereCotizacion ?? false}
          />
          <Label htmlFor="requiereCotizacion" className="font-normal">
            Requiere cotización (no tiene precio fijo cerrado)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="activo"
            name="activo"
            defaultChecked={defaultValues?.activo ?? true}
          />
          <Label htmlFor="activo" className="font-normal">
            Activo (disponible para nuevas ventas)
          </Label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
