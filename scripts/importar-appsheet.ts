/**
 * Importa Clientes, Servicios, Órdenes de Cambio y Pagos (con imagen de
 * comprobante) desde el Excel exportado de AppSheet.
 *
 * Uso:
 *   npx tsx scripts/importar-appsheet.ts
 *
 * Es re-ejecutable de forma segura: guarda un checkpoint en
 * scripts/_appsheet-import-checkpoint.json con el mapeo AppSheet-ID -> ID
 * real en la base, y con los ids de Órdenes/Pagos ya importados. Si el
 * script se interrumpe a la mitad, al volver a correrlo retoma donde se
 * quedó en vez de duplicar registros.
 *
 * NO se importan Cotizaciones (fuera de alcance de este import).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient, type Etiqueta, type MedioCaptacion, type MetodoPago, type StatusServicio } from "../src/generated/prisma/client";
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
};

function cargarCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8"));
  }
  return { intermediarios: {}, clientes: {}, servicios: {}, ordenes: {}, pagos: {} };
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

// ---------- Mapeos de catálogos AppSheet -> enums del CRM ----------

function mapEtiqueta(source: string | null): { etiqueta: Etiqueta | null; notaExtra: string | null } {
  switch (source) {
    case "Cliente VIP":
      return { etiqueta: "VIP", notaExtra: null };
    case "Cliente Premium":
      return { etiqueta: "Premium", notaExtra: null };
    case "Cliente Platinum":
      return { etiqueta: "Platinum", notaExtra: null };
    case "Descartado":
      return { etiqueta: null, notaExtra: "Etiqueta original (AppSheet): Descartado" };
    case "Prospecto Calificado":
      return { etiqueta: null, notaExtra: "Etiqueta original (AppSheet): Prospecto Calificado" };
    default:
      return { etiqueta: null, notaExtra: null };
  }
}

function mapMedioCaptacion(source: string | null): { medio: MedioCaptacion | null; notaExtra: string | null } {
  switch (source) {
    case "Grupo de Facebook":
      return { medio: "Grupo", notaExtra: null };
    case "Facebook Ads":
      return { medio: "FacebookAds", notaExtra: null };
    case "Kevin":
      return { medio: "Intermediario", notaExtra: null };
    case "Otro":
      return { medio: "Otro", notaExtra: null };
    case "Recomendacion":
      return { medio: "Otro", notaExtra: "Medio de captación original (AppSheet): Recomendación" };
    default:
      return { medio: null, notaExtra: null };
  }
}

function mapStatusServicio(source: string): StatusServicio {
  switch (source) {
    case "Terminado":
      return "Entregado";
    case "Pendiente":
      return "Aprobado";
    case "En Progreso":
      return "EnProceso";
    default:
      throw new Error(`Status de servicio desconocido: ${source}`);
  }
}

function mapMetodoPago(source: string): MetodoPago {
  switch (source) {
    case "Trasferencia":
      return "Transferencia";
    case "Paypal":
      return "PayPal";
    case "Efectivo":
      return "Efectivo";
    case "Western Union":
      return "WesternUnion";
    case "Binance":
      return "Binance";
    case "Deposito":
      return "Deposito";
    case "Otro":
      return "Otro";
    default:
      throw new Error(`Método de pago desconocido: ${source}`);
  }
}

function mimeDeArchivo(nombre: string): string {
  const ext = path.extname(nombre).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const clienteRows = rows(wb.getWorksheet("Cliente")!);
  const servicioRows = rows(wb.getWorksheet("Servicios")!);
  const ordenRows = rows(wb.getWorksheet("Ordenes de Cambio")!);
  const pagoRows = rows(wb.getWorksheet("Pagos")!);
  const intermediarioRows = rows(wb.getWorksheet("Intermediario")!);

  const cp = cargarCheckpoint();

  // ---------- 1. Intermediarios ----------
  console.log(`\n== Intermediarios (${intermediarioRows.length}) ==`);
  for (const r of intermediarioRows) {
    const [id, nombre, , telefono, email, notas] = r as [string, string, string, unknown, unknown, string];
    if (cp.intermediarios[id]) continue;
    const creado = await prisma.intermediario.create({
      data: {
        nombre: str(nombre) ?? "Sin nombre",
        telefono: str(telefono),
        email: str(email),
        notas: str(notas),
      },
    });
    cp.intermediarios[id] = creado.id;
    guardarCheckpoint(cp);
    console.log(`  + ${nombre} -> id ${creado.id}`);
  }

  // ---------- 2. Clientes ----------
  console.log(`\n== Clientes (${clienteRows.length}) ==`);
  for (const r of clienteRows) {
    const [id, etiquetaRaw, nombre, pais, telefono, email, notas, medioRaw] = r as [
      string,
      string | null,
      string,
      unknown,
      unknown,
      unknown,
      string | null,
      string | null,
    ];
    if (cp.clientes[id]) continue;

    const { etiqueta, notaExtra: notaEt } = mapEtiqueta(str(etiquetaRaw));
    const { medio, notaExtra: notaMedio } = mapMedioCaptacion(str(medioRaw));

    const notasFinal = [str(notas), notaEt, notaMedio].filter(Boolean).join("\n\n") || null;

    const creado = await prisma.cliente.create({
      data: {
        nombre: str(nombre) ?? "Sin nombre",
        pais: str(pais),
        telefono: str(telefono),
        email: str(email),
        notas: notasFinal,
        etiqueta,
        medioCaptacion: medio,
      },
    });
    cp.clientes[id] = creado.id;
    guardarCheckpoint(cp);
    console.log(`  + ${nombre} -> id ${creado.id}`);
  }

  // ---------- 3. Servicios ----------
  console.log(`\n== Servicios (${servicioRows.length}) ==`);
  for (const r of servicioRows) {
    const [
      id,
      fechaInicioRaw,
      fechaFinRaw,
      clienteIdRaw,
      descripcion,
      detalles,
      montoInicialRaw,
      tieneIntermediario,
      intermediarioIdRaw,
      pctRaw,
      statusRaw,
    ] = r as [
      string,
      unknown,
      unknown,
      string,
      string,
      string | null,
      number,
      boolean,
      string | null,
      number | null,
      string,
    ];
    if (cp.servicios[id]) continue;

    const clienteId = cp.clientes[clienteIdRaw];
    if (!clienteId) throw new Error(`Servicio ${id}: cliente ${clienteIdRaw} no importado`);

    let intermediarioId: number | null = null;
    let porcentaje: number | null = null;
    if (tieneIntermediario && intermediarioIdRaw) {
      intermediarioId = cp.intermediarios[intermediarioIdRaw] ?? null;
      if (!intermediarioId) throw new Error(`Servicio ${id}: intermediario ${intermediarioIdRaw} no importado`);
      porcentaje = pctRaw ? Math.round(pctRaw * 100 * 100) / 100 : null; // 0.4 -> 40
    }

    const creado = await prisma.servicio.create({
      data: {
        fechaInicio: fecha(fechaInicioRaw) ?? new Date(),
        fechaFin: fecha(fechaFinRaw),
        clienteId,
        descripcion: str(descripcion) ?? "Servicio importado",
        detalles: str(detalles),
        montoInicial: num(montoInicialRaw),
        intermediarioId,
        porcentajeIntermediario: porcentaje,
        status: mapStatusServicio(String(statusRaw)),
      },
    });
    cp.servicios[id] = creado.id;
    guardarCheckpoint(cp);
    console.log(`  + ${descripcion} -> id ${creado.id}`);
  }

  // ---------- 4. Órdenes de cambio ----------
  console.log(`\n== Órdenes de cambio (${ordenRows.length}) ==`);
  for (const r of ordenRows) {
    const [id, servicioIdRaw, descripcion, monto] = r as [string, string, string, number];
    if (cp.ordenes[id]) continue;

    const servicioId = cp.servicios[servicioIdRaw];
    if (!servicioId) throw new Error(`Orden ${id}: servicio ${servicioIdRaw} no importado`);

    await prisma.ordenCambio.create({
      data: {
        servicioId,
        descripcion: str(descripcion) ?? "Orden de cambio importada",
        monto: num(monto),
        // Históricas: ya sucedieron y su monto forma parte del total real del
        // servicio, por eso se marcan Aprobada (si no, montoTotalServicio las
        // ignoraría y el total facturado se vería incompleto).
        status: "Aprobada",
      },
    });
    cp.ordenes[id] = true;
    guardarCheckpoint(cp);
  }
  console.log(`  ${ordenRows.length} procesadas`);

  // ---------- 5. Pagos + comprobante ----------
  console.log(`\n== Pagos (${pagoRows.length}) ==`);
  let sinComprobante = 0;
  let comprobanteNoEncontrado = 0;
  for (const r of pagoRows) {
    const [id, servicioIdRaw, fechaRaw, metodoRaw, montoRaw, comisionRaw, comprobanteRaw, cuenta] = r as [
      string,
      string,
      unknown,
      string,
      number,
      number | null,
      string | null,
      unknown,
    ];
    if (cp.pagos[id]) continue;

    const servicioId = cp.servicios[servicioIdRaw];
    if (!servicioId) throw new Error(`Pago ${id}: servicio ${servicioIdRaw} no importado`);

    const pago = await prisma.pago.create({
      data: {
        servicioId,
        fecha: fecha(fechaRaw) ?? new Date(),
        metodoPago: mapMetodoPago(String(metodoRaw)),
        monto: num(montoRaw),
        comision: comisionRaw ?? null,
        cuenta: str(cuenta),
        confirmado: true,
      },
    });

    const comprobanteRel = str(comprobanteRaw);
    if (comprobanteRel) {
      const filePath = path.join(DATOS_DIR, comprobanteRel);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const mime = mimeDeArchivo(filePath);
        const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
        await prisma.archivo.create({
          data: {
            entidadTipo: "Pago",
            entidadId: pago.id,
            nombre: path.basename(filePath),
            url: dataUrl,
            tipo: "Imagen",
            tamanioBytes: buffer.length,
          },
        });
      } else {
        comprobanteNoEncontrado++;
        console.warn(`  ! Comprobante no encontrado en disco: ${filePath} (pago ${id})`);
      }
    } else {
      sinComprobante++;
    }

    cp.pagos[id] = true;
    guardarCheckpoint(cp);
  }
  console.log(`  ${pagoRows.length} procesados (${sinComprobante} sin comprobante, ${comprobanteNoEncontrado} con imagen faltante en disco)`);

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
