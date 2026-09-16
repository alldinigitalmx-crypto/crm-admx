"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Wand2 } from "lucide-react";

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
import { ClienteRapidoDialog } from "@/components/clientes/cliente-rapido-dialog";
import { crearClienteRapido } from "@/app/admin/clientes/actions";
import { formatCurrency } from "@/lib/format";
import type { ServicioFormState } from "@/app/admin/servicios/actions";

const STATUSES = ["Cotizado", "Aprobado", "EnProceso", "Entregado", "Cancelado"] as const;

type ServicioDefaults = {
  clienteId: number;
  descripcion: string;
  detalles: string | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  montoInicial: number | string | { toString(): string };
  moneda: string | null;
  montoInicialMXN: (number | string | { toString(): string }) | null;
  status: string;
  intermediarioId: number | null;
  porcentajeIntermediario: (number | string | { toString(): string }) | null;
  responsableId: number | null;
};

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function ServicioForm({
  action,
  clientes,
  intermediarios,
  usuarios,
  usuarioActualId,
  defaultValues,
  submitLabel,
  onCancel,
}: {
  action: (
    prevState: ServicioFormState,
    formData: FormData
  ) => Promise<ServicioFormState>;
  clientes: { id: number; nombre: string }[];
  intermediarios: { id: number; nombre: string }[];
  usuarios: { id: number; nombre: string }[];
  usuarioActualId?: number;
  defaultValues?: ServicioDefaults;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [clientesDisponibles, setClientesDisponibles] = useState(clientes);
  const [clienteId, setClienteId] = useState<string>(
    defaultValues ? String(defaultValues.clienteId) : ""
  );
  // Radix Select solo "descubre" la etiqueta de un value cuando ese
  // SelectItem llegó a montarse al menos una vez — si el cliente nuevo se
  // selecciona por código sin que el usuario haya abierto el desplegable,
  // se queda mostrando el placeholder aunque el value ya cambió. Forzar un
  // remount (cambiando key) justo en ese momento resuelve el desajuste.
  const [selectKey, setSelectKey] = useState(0);
  // Memorizado — si se recrea en cada render (p. ej. inline .bind()),
  // useActionState de ClienteRapidoDialog pierde el estado justo después
  // de crear el cliente, antes de que el auto-select alcance a aplicarse.
  const crearClienteRapidoAction = useMemo(() => crearClienteRapido.bind(null, null), []);

  // Mismo patrón que PagoForm: el servicio arranca en pesos salvo que ya
  // viniera cotizado en otra moneda (al editar uno existente).
  const [monedaEsExtranjera, setMonedaEsExtranjera] = useState(
    Boolean(defaultValues?.moneda && defaultValues.moneda !== "MXN")
  );
  const [moneda, setMoneda] = useState(
    defaultValues?.moneda && defaultValues.moneda !== "MXN" ? defaultValues.moneda : "USD"
  );
  const montoRef = useRef<HTMLInputElement>(null);
  const montoMXNRef = useRef<HTMLInputElement>(null);
  const [cargandoTipoCambio, setCargandoTipoCambio] = useState(false);
  const [tipoCambioInfo, setTipoCambioInfo] = useState<{ rate: number; fecha: string | null } | null>(null);
  const [tipoCambioError, setTipoCambioError] = useState<string | null>(null);

  // Solo para el preview de "lo que cobras" -- el cálculo real y definitivo
  // vive en comisionIntermediario()/montoPropioServicio() (lib/servicio.ts);
  // aquí solo se reproduce para mostrarlo mientras el usuario captura.
  const [montoPreview, setMontoPreview] = useState(
    defaultValues ? String(defaultValues.montoInicial) : ""
  );
  const [porcentajePreview, setPorcentajePreview] = useState(
    defaultValues?.porcentajeIntermediario ? String(defaultValues.porcentajeIntermediario) : ""
  );
  const montoNum = Number(montoPreview) || 0;
  const porcentajeNum = Number(porcentajePreview) || 0;
  const comisionIntermediarioPreview = montoNum * (porcentajeNum / 100);
  const cobrasPreview = montoNum - comisionIntermediarioPreview;

  async function usarTipoCambioDeHoy() {
    const montoActual = Number(montoRef.current?.value ?? "");
    if (!montoActual || montoActual <= 0) {
      setTipoCambioError("Captura primero el monto inicial.");
      return;
    }
    setCargandoTipoCambio(true);
    setTipoCambioError(null);
    try {
      const res = await fetch(`/api/tipo-cambio?from=${moneda}&monto=${montoActual}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo obtener el tipo de cambio.");
      if (montoMXNRef.current) montoMXNRef.current.value = Number(data.mxn).toFixed(2);
      setTipoCambioInfo({ rate: data.rate, fecha: data.fecha });
    } catch (err) {
      setTipoCambioError(err instanceof Error ? err.message : "No se pudo obtener el tipo de cambio.");
    } finally {
      setCargandoTipoCambio(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="descripcion">Descripción *</Label>
          <Input
            id="descripcion"
            name="descripcion"
            required
            defaultValue={defaultValues?.descripcion}
            placeholder="Ej. Sitio web corporativo"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="clienteId">Cliente *</Label>
            <ClienteRapidoDialog
              trigger={
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Nuevo cliente
                </button>
              }
              action={crearClienteRapidoAction}
              onCreated={(cliente) => {
                setClientesDisponibles((prev) => [...prev, cliente]);
                setClienteId(String(cliente.id));
                setSelectKey((k) => k + 1);
              }}
            />
          </div>
          <Select
            key={selectKey}
            name="clienteId"
            required
            defaultValue={clienteId || undefined}
            onValueChange={setClienteId}
          >
            <SelectTrigger id="clienteId" className="w-full">
              <SelectValue placeholder="Selecciona un cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientesDisponibles.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={defaultValues?.status ?? "Cotizado"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fechaInicio">Fecha de inicio *</Label>
          <Input
            id="fechaInicio"
            name="fechaInicio"
            type="date"
            required
            defaultValue={toDateInputValue(defaultValues?.fechaInicio)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fechaFin">Fecha de fin</Label>
          <Input
            id="fechaFin"
            name="fechaFin"
            type="date"
            defaultValue={toDateInputValue(defaultValues?.fechaFin)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="montoInicial">Monto inicial *</Label>
          <Input
            id="montoInicial"
            name="montoInicial"
            ref={montoRef}
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={
              defaultValues ? String(defaultValues.montoInicial) : ""
            }
            placeholder="0.00"
            onChange={(e) => setMontoPreview(e.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-input p-3 sm:col-span-2">
          <input type="hidden" name="moneda" value={monedaEsExtranjera ? moneda : "MXN"} />
          <div className="flex items-center gap-2">
            <Checkbox
              id="monedaEsExtranjera"
              checked={monedaEsExtranjera}
              onCheckedChange={(v) => setMonedaEsExtranjera(v === true)}
            />
            <Label htmlFor="monedaEsExtranjera" className="font-normal">
              Este servicio se cotizó en otra moneda (no pesos)
            </Label>
          </div>

          {monedaEsExtranjera && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="monedaSelect">Moneda</Label>
                <Select value={moneda} onValueChange={setMoneda}>
                  <SelectTrigger id="monedaSelect" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="COP">COP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="montoInicialMXN">Equivalente en pesos (MXN) *</Label>
                <div className="flex gap-2">
                  <Input
                    id="montoInicialMXN"
                    name="montoInicialMXN"
                    ref={montoMXNRef}
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={
                      defaultValues?.montoInicialMXN ? String(defaultValues.montoInicialMXN) : ""
                    }
                    placeholder="0.00"
                    onChange={() => setTipoCambioInfo(null)}
                  />
                  {(moneda === "USD" || moneda === "EUR") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Sugerir con el tipo de cambio de hoy"
                      disabled={cargandoTipoCambio}
                      onClick={usarTipoCambioDeHoy}
                    >
                      <Wand2 className={cargandoTipoCambio ? "animate-pulse" : undefined} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground sm:col-span-2">
                <p>
                  El campo &quot;Monto inicial&quot; de arriba queda en {moneda}. Aquí captura el
                  equivalente aproximado en pesos al momento de cotizar — es solo de referencia
                  (no se recalcula solo con el tiempo, como el tipo de cambio real de cada pago).
                </p>
                {(moneda === "USD" || moneda === "EUR") && (
                  <p className="mt-1">
                    {tipoCambioError ? (
                      <span className="text-destructive">{tipoCambioError}</span>
                    ) : tipoCambioInfo ? (
                      <>
                        Sugerido con 1 {moneda} ≈ {tipoCambioInfo.rate.toFixed(2)} MXN (
                        {tipoCambioInfo.fecha ?? "hoy"}) — ajústalo si cotizaste con otro tipo de
                        cambio.
                      </>
                    ) : (
                      <>
                        Usa <Wand2 className="inline size-3" /> para partir del tipo de cambio de
                        hoy y ajústalo si cotizaste distinto.
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="intermediarioId">Intermediario</Label>
          <Select
            name="intermediarioId"
            defaultValue={
              defaultValues?.intermediarioId
                ? String(defaultValues.intermediarioId)
                : "none"
            }
          >
            <SelectTrigger id="intermediarioId" className="w-full">
              <SelectValue placeholder="Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {intermediarios.map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>
                  {i.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="responsableId">Responsable *</Label>
          <Select
            name="responsableId"
            required
            defaultValue={
              defaultValues?.responsableId
                ? String(defaultValues.responsableId)
                : usuarioActualId
                  ? String(usuarioActualId)
                  : undefined
            }
          >
            <SelectTrigger id="responsableId" className="w-full">
              <SelectValue placeholder="Selecciona un responsable" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="porcentajeIntermediario">% comisión intermediario</Label>
          <Input
            id="porcentajeIntermediario"
            name="porcentajeIntermediario"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={
              defaultValues?.porcentajeIntermediario
                ? String(defaultValues.porcentajeIntermediario)
                : ""
            }
            placeholder="Ej. 10"
            onChange={(e) => setPorcentajePreview(e.target.value)}
          />
          {porcentajeNum > 0 && montoNum > 0 && (
            <p className="text-xs text-muted-foreground">
              El intermediario se lleva{" "}
              {formatCurrency(comisionIntermediarioPreview, monedaEsExtranjera ? moneda : "MXN")} — tú
              cobras{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(cobrasPreview, monedaEsExtranjera ? moneda : "MXN")}
              </span>
              .
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="detalles">Detalles</Label>
          <Textarea
            id="detalles"
            name="detalles"
            rows={4}
            defaultValue={defaultValues?.detalles ?? ""}
            placeholder="Alcance y notas del servicio"
          />
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
