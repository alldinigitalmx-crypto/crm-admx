/**
 * Importa Cuentas (hoja "MetodoPago"), Gastos (hoja "Gatos") y Retiros
 * (hoja "Retiros") desde el Excel exportado de AppSheet, y de paso
 * vincula los Pagos ya importados a su Cuenta real (antes el campo
 * "Cuenta" del Excel se guardaba como texto libre en Pago.cuentaTexto).
 *
 * Uso:
 *   npx dotenvx run -- npx tsx scripts/importar-cuentas-gastos.ts
 *
 * Es re-ejecutable de forma segura: guarda un checkpoint en
 * scripts/_cuentas-gastos-import-checkpoint.json. Si se interrumpe a la
 * mitad, al volver a correrlo retoma donde se quedó en vez de duplicar.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient, type MetodoPago, type TipoCuenta } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const XLSX_PATH = "C:\\Users\\anton\\Desktop\\Datos\\App ADMx .xlsx";
const CHECKPOINT_PATH = path.join(__dirname, "_cuentas-gastos-import-checkpoint.json");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type Checkpoint = {
  cuentas: Record<string, number>;
  pagosVinculados: boolean;
  gastos: Record<string, true>;
  retiros: Record<string, true>;
};

function cargarCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8"));
  }
  return { cuentas: {}, pagosVinculados: false, gastos: {}, retiros: {} };
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
  if (!s || s === "-") return null;
  return s;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fecha(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapMetodoPago(source: string): MetodoPago {
  switch (source) {
    case "Trasferencia":
    case "Transferencia":
      return "Transferencia";
    case "Efectivo":
      return "Efectivo";
    case "Tarjeta":
      return "Tarjeta";
    default:
      throw new Error(`Método de pago desconocido en Gastos: ${source}`);
  }
}

// Las 7 cuentas de la hoja MetodoPago no cambian de tipo entre corridas —
// se resuelve a mano en vez de con heurística, es más confiable para un
// import de una sola vez.
const TIPO_POR_ALIAS: Record<string, TipoCuenta> = {
  "Antonio BBVA": "Banco",
  "antoniohep56@gmail.com": "Billetera",
  "Spin Oxxo Antonio": "Billetera",
  "Mercado pago Antonio": "Billetera",
  "Brisa BBVA": "Banco",
  Efectivo: "Efectivo",
  "Spin Brisa": "Billetera",
};

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const cp = cargarCheckpoint();

  // ---------- 1. Cuentas (hoja MetodoPago) ----------
  const metodoPagoRows = rows(wb.getWorksheet("MetodoPago")!);
  console.log(`\n== Cuentas (${metodoPagoRows.length}) ==`);
  for (const r of metodoPagoRows) {
    const [idRaw, alias, banco, cuentaNum, clabe, swift] = r as [
      unknown,
      string,
      string | null,
      unknown,
      unknown,
      unknown,
    ];
    const id = String(idRaw);
    if (cp.cuentas[id]) continue;

    const aliasLimpio = str(alias) ?? `Cuenta ${id}`;
    const creada = await prisma.cuenta.create({
      data: {
        alias: aliasLimpio,
        tipo: TIPO_POR_ALIAS[aliasLimpio] ?? "Banco",
        banco: str(banco),
        numeroCuenta: str(cuentaNum),
        clabe: str(clabe),
        swift: str(swift),
      },
    });
    cp.cuentas[id] = creada.id;
    guardarCheckpoint(cp);
    console.log(`  + ${aliasLimpio} -> id ${creada.id}`);
  }

  // ---------- 2. Vincular Pagos ya importados a su Cuenta real ----------
  if (!cp.pagosVinculados) {
    console.log("\n== Vinculando Pagos existentes por cuentaTexto ==");
    const pagosConTexto = await prisma.pago.findMany({
      where: { cuentaTexto: { not: null }, cuentaId: null },
      select: { id: true, cuentaTexto: true },
    });
    let vinculados = 0;
    let sinMapeo = 0;
    for (const p of pagosConTexto) {
      const cuentaId = cp.cuentas[p.cuentaTexto!];
      if (!cuentaId) {
        sinMapeo++;
        console.warn(`  ! Pago ${p.id}: cuentaTexto "${p.cuentaTexto}" sin cuenta mapeada`);
        continue;
      }
      await prisma.pago.update({ where: { id: p.id }, data: { cuentaId } });
      vinculados++;
    }
    console.log(`  ${vinculados} pagos vinculados, ${sinMapeo} sin mapeo`);
    cp.pagosVinculados = true;
    guardarCheckpoint(cp);
  }

  // ---------- 3. Gastos (hoja Gatos, con categorías desde "Categoria Gastos") ----------
  const categoriaRows = rows(wb.getWorksheet("Categoria Gastos")!);
  const categoriaPorId = new Map<string, string>();
  for (const r of categoriaRows) {
    const [id, descripcion] = r as [unknown, string];
    categoriaPorId.set(String(id), str(descripcion) ?? String(id));
  }

  const gastoRows = rows(wb.getWorksheet("Gatos")!);
  console.log(`\n== Gastos (${gastoRows.length}) ==`);
  let gastosCreados = 0;
  for (const r of gastoRows) {
    const [idRaw, categoriaIdRaw, fechaRaw, descripcion, montoRaw, metodoRaw, cuentaRaw] = r as [
      unknown,
      unknown,
      unknown,
      string,
      number,
      string,
      unknown,
    ];
    const id = String(idRaw);
    if (cp.gastos[id]) continue;

    const categoriaId = String(categoriaIdRaw);
    const categoria = categoriaPorId.get(categoriaId) ?? categoriaId;
    const cuentaExcelId = str(cuentaRaw);
    const cuentaId = cuentaExcelId ? (cp.cuentas[cuentaExcelId] ?? null) : null;
    if (cuentaExcelId && !cuentaId) {
      console.warn(`  ! Gasto ${id}: cuenta "${cuentaExcelId}" sin mapear`);
    }

    await prisma.gasto.create({
      data: {
        descripcion: str(descripcion) ?? "Gasto importado",
        categoria,
        // La única categoría de negocio en este historial es "Admx" —
        // el resto son gastos personales del dueño.
        ambito: categoria === "Admx" ? "Empresa" : "Personal",
        monto: num(montoRaw),
        metodoPago: mapMetodoPago(String(metodoRaw)),
        fecha: fecha(fechaRaw) ?? new Date(),
        cuentaId,
      },
    });
    cp.gastos[id] = true;
    guardarCheckpoint(cp);
    gastosCreados++;
  }
  console.log(`  ${gastosCreados} gastos creados`);

  // ---------- 4. Retiros ----------
  const retiroRows = rows(wb.getWorksheet("Retiros")!);
  console.log(`\n== Retiros (${retiroRows.length}) ==`);
  let retirosCreados = 0;
  for (const r of retiroRows) {
    const [idRaw, fechaRaw, cuentaRaw, montoRaw, comentario] = r as [
      unknown,
      unknown,
      unknown,
      number,
      string | null,
    ];
    const id = String(idRaw);
    if (cp.retiros[id]) continue;

    const cuentaExcelId = str(cuentaRaw);
    const cuentaId = cuentaExcelId ? cp.cuentas[cuentaExcelId] : null;
    if (!cuentaId) {
      console.warn(`  ! Retiro ${id}: cuenta "${cuentaExcelId}" sin mapear, se omite`);
      continue;
    }

    await prisma.retiro.create({
      data: {
        cuentaId,
        fecha: fecha(fechaRaw) ?? new Date(),
        monto: num(montoRaw),
        comentario: str(comentario),
      },
    });
    cp.retiros[id] = true;
    guardarCheckpoint(cp);
    retirosCreados++;
  }
  console.log(`  ${retirosCreados} retiros creados`);

  console.log("\n✅ Import completo.");
}

main()
  .catch((e) => {
    console.error("\n❌ Error (el checkpoint guardó el progreso hasta antes de este punto, se puede reintentar):", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
