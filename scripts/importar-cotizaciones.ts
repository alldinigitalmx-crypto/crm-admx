/**
 * Importa Cotizaciones desde el Excel exportado de AppSheet (hoja
 * "Cotizaciones" + "Detalle Cotizaciones"). Complementa a
 * importar-appsheet.ts (que trajo clientes/servicios/órdenes/pagos) —
 * reutiliza el mismo checkpoint para mapear AppSheet-ID -> ID real.
 *
 * Decisiones de importación (sin dato de status/outcome en el Excel):
 * - Se importan como negociaciones independientes: servicioId = null,
 *   status = "Vencida" (no aparecen en "Cotizaciones por firmar/pagar"
 *   del panel, pero sí en el listado del módulo). Si alguna sí se ganó,
 *   se puede reabrir/editar y usar "Convertir en servicio" a mano.
 * - montoSubtotal/montoTotal = suma de líneas de "Detalle Cotizaciones"
 *   (cantidad × precio unitario) — el esquema no tiene tabla de línea de
 *   detalle, así que las líneas se preservan como texto en `detalles`.
 * - creadoEn se fija a la fecha de emisión real (no "hoy"), para no
 *   ensuciar reportes de "nuevas este mes" con historia de 2025.
 *
 * Uso: npx tsx scripts/importar-cotizaciones.ts
 * Re-ejecutable: usa scripts/_appsheet-import-checkpoint.json para no
 * duplicar si se corre más de una vez.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATOS_DIR = "C:\\Users\\anton\\Desktop\\Datos";
const XLSX_PATH = path.join(DATOS_DIR, "App ADMx .xlsx");
const CHECKPOINT_PATH = path.join(__dirname, "_appsheet-import-checkpoint.json");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type Checkpoint = {
  intermediarios: Record<string, number>;
  clientes: Record<string, number>;
  servicios: Record<string, number>;
  ordenes: Record<string, true>;
  pagos: Record<string, true>;
  cotizaciones?: Record<string, true>;
};

function cargarCheckpoint(): Checkpoint {
  const cp = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8")) as Checkpoint;
  cp.cotizaciones ??= {};
  return cp;
}

function guardarCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function rows(ws: ExcelJS.Worksheet): unknown[][] {
  const out: unknown[][] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as unknown[]).slice(1);
    const nonEmpty = values.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (nonEmpty) out.push(values);
  });
  return out;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function fecha(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const cotRows = rows(wb.getWorksheet("Cotizaciones")!);
  const detRows = rows(wb.getWorksheet("Detalle Cotizaciones")!);

  const cp = cargarCheckpoint();

  console.log(`\n== Cotizaciones (${cotRows.length}) ==`);
  let sinCliente = 0;

  for (const r of cotRows) {
    const [id, numero, fechaEmisionRaw, clienteIdRaw, proyecto, tipo, duracion] = r as [
      string,
      string | number,
      unknown,
      string,
      string,
      string,
      string | null,
    ];
    if (cp.cotizaciones![id]) continue;

    const clienteId = cp.clientes[clienteIdRaw];
    if (!clienteId) {
      console.warn(`  ! Cotización ${id} (${proyecto}): cliente ${clienteIdRaw} no existe en el import de clientes — se omite.`);
      sinCliente++;
      continue;
    }

    const lineas = detRows.filter((d) => d[1] === id) as [string, string, string, number, string, number][];
    const montoTotal = lineas.reduce((acc, l) => acc + num(l[3]) * num(l[5]), 0);

    const detalleLineas = lineas
      .map((l) => `• ${str(l[2]) ?? "Sin descripción"} — ${num(l[3])} ${str(l[4]) ?? ""} × ${num(l[5])}`.trim())
      .join("\n");
    const detallesPartes = [
      tipo ? `Tipo: ${tipo}` : null,
      duracion ? `Duración estimada: ${duracion}` : null,
      detalleLineas ? `\nDetalle:\n${detalleLineas}` : null,
      `\n[Importado de AppSheet — cotización Nº ${numero}]`,
    ].filter(Boolean);

    const fechaEmision = fecha(fechaEmisionRaw) ?? new Date();

    const creada = await prisma.cotizacion.create({
      data: {
        clienteId,
        descripcion: str(proyecto) ?? "Cotización importada",
        detalles: detallesPartes.join("\n"),
        token: crypto.randomUUID(),
        status: "Vencida",
        montoSubtotal: montoTotal,
        montoTotal,
        fechaEmision,
        creadoEn: fechaEmision,
      },
    });

    cp.cotizaciones![id] = true;
    guardarCheckpoint(cp);
    console.log(`  + ${proyecto} (${montoTotal}) -> id ${creada.id}`);
  }

  console.log(`\n${cotRows.length - sinCliente} importadas, ${sinCliente} omitidas por cliente faltante.`);
  console.log("\n✅ Import completo.");
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

main()
  .catch((e) => {
    console.error("\n❌ Error (el checkpoint guardó el progreso hasta antes de este punto, se puede reintentar):", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
