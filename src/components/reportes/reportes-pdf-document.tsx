import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

import { businessInfo } from "@/lib/business-info";
import type { ReporteData } from "@/lib/reportes-data";

const logoDataUri = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "admx-logo-ink.png"))
  .toString("base64")}`;

const INK = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const GOOD = "#059669";
const BAD = "#dc2626";
const PANEL = "#f9fafb";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: INK },

  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  logo: { width: 48, marginBottom: 6 },
  companyName: { fontSize: 16, fontWeight: 700, letterSpacing: 0.5 },
  companyTagline: { fontSize: 8, color: MUTED, marginTop: 2 },

  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 18, fontWeight: 700, letterSpacing: 1 },
  metaLine: { fontSize: 9, marginTop: 6, color: "#374151" },
  metaLabel: { fontWeight: 700 },

  divider: { borderBottomWidth: 2, borderBottomColor: INK, marginTop: 14, marginBottom: 16 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18, gap: 8 },
  kpiBox: {
    width: "32%",
    backgroundColor: PANEL,
    borderRadius: 3,
    padding: 8,
    marginBottom: 8,
  },
  kpiLabel: { fontSize: 7.5, color: MUTED, marginBottom: 3 },
  kpiValue: { fontSize: 13, fontWeight: 700 },
  kpiSub: { fontSize: 7, color: MUTED, marginTop: 2 },

  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: INK,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 16,
    marginBottom: 6,
  },

  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableHeaderCell: { fontSize: 7.5, fontWeight: 700, color: "#374151" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 4,
  },
  cellText: { fontSize: 8, color: "#1f2937" },

  colLabel: { width: "46%" },
  colCount: { width: "18%", textAlign: "right" },
  colMonto: { width: "36%", textAlign: "right" },

  colPeriodo: { width: "34%" },
  colValorTrend: { width: "33%", textAlign: "right" },

  footer: { marginTop: 24, textAlign: "center", fontSize: 8, color: MUTED },
});

const currency = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fechaFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fechaCorta = (d: Date) => fechaFormatter.format(new Date(d));

function Tabla({
  titulo,
  filas,
  vacio,
  formatoValor = "moneda",
}: {
  titulo: string;
  filas: { label: string; monto: number; count: number }[];
  vacio: string;
  formatoValor?: "moneda" | "numero";
}) {
  return (
    <View wrap={false}>
      <Text style={styles.sectionTitle}>{titulo}</Text>
      {filas.length === 0 ? (
        <Text style={[styles.cellText, { color: MUTED }]}>{vacio}</Text>
      ) : (
        <>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colLabel]}>Concepto</Text>
            <Text style={[styles.tableHeaderCell, styles.colCount]}>Cantidad</Text>
            <Text style={[styles.tableHeaderCell, styles.colMonto]}>
              {formatoValor === "moneda" ? "Monto" : "Total"}
            </Text>
          </View>
          {filas.map((f) => (
            <View style={styles.tableRow} key={f.label}>
              <Text style={[styles.cellText, styles.colLabel]}>{f.label}</Text>
              <Text style={[styles.cellText, styles.colCount]}>{f.count}</Text>
              <Text style={[styles.cellText, styles.colMonto]}>
                {formatoValor === "moneda" ? currency(f.monto) : f.monto}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

export function ReportesPdfDocument({ datos }: { datos: ReporteData }) {
  const generadoEl = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date());

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
            <Image src={logoDataUri} style={styles.logo} />
            <Text style={styles.companyName}>{businessInfo.nombre}</Text>
            <Text style={styles.companyTagline}>{businessInfo.eslogan}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>REPORTE</Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Rango: </Text>
              {fechaCorta(datos.desdeEfectivo)} — {fechaCorta(datos.hastaEfectivo)}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Generado: </Text>
              {generadoEl}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOTAL RECAUDADO</Text>
            <Text style={[styles.kpiValue, { color: GOOD }]}>{currency(datos.totalRecaudado)}</Text>
            <Text style={styles.kpiSub}>{datos.pagosCount} pagos confirmados</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>GASTOS (EMPRESA)</Text>
            <Text style={[styles.kpiValue, { color: BAD }]}>{currency(datos.totalGastos)}</Text>
            <Text style={styles.kpiSub}>{datos.gastosCount} movimientos</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>UTILIDAD NETA</Text>
            <Text style={[styles.kpiValue, { color: datos.utilidadNeta >= 0 ? GOOD : BAD }]}>
              {currency(datos.utilidadNeta)}
            </Text>
            <Text style={styles.kpiSub}>Recaudado - gastos</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>SERVICIOS ENTREGADOS</Text>
            <Text style={styles.kpiValue}>{datos.serviciosEntregadosCount}</Text>
            <Text style={styles.kpiSub}>Por fecha de fin</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>SERVICIOS NUEVOS</Text>
            <Text style={styles.kpiValue}>{datos.serviciosNuevosCount}</Text>
            <Text style={styles.kpiSub}>Por fecha de inicio</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>CLIENTES NUEVOS</Text>
            <Text style={styles.kpiValue}>{datos.clientesNuevosCount}</Text>
          </View>
        </View>

        <Tabla titulo="Servicios por status" filas={datos.statusItems} vacio="Sin servicios en este rango." formatoValor="numero" />
        <Tabla titulo="Pagos por método" filas={datos.metodoItems} vacio="Sin pagos confirmados en este rango." />
        <Tabla titulo="Gastos por categoría" filas={datos.gastosItems} vacio="Sin gastos de empresa en este rango." />

        {datos.totalGastosPersonales > 0 && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>
              Gastos personales (informativo — no forman parte de la utilidad del negocio)
            </Text>
            <View style={styles.tableRow}>
              <Text style={[styles.cellText, styles.colLabel]}>Total del periodo</Text>
              <Text style={[styles.cellText, styles.colCount]}>{datos.gastosPersonalesCount}</Text>
              <Text style={[styles.cellText, styles.colMonto]}>{currency(datos.totalGastosPersonales)}</Text>
            </View>
            {datos.gastosPersonalesItems.map((f) => (
              <View style={styles.tableRow} key={f.label}>
                <Text style={[styles.cellText, styles.colLabel, { color: MUTED }]}>{f.label}</Text>
                <Text style={[styles.cellText, styles.colCount, { color: MUTED }]}>{f.count}</Text>
                <Text style={[styles.cellText, styles.colMonto, { color: MUTED }]}>{currency(f.monto)}</Text>
              </View>
            ))}
          </View>
        )}

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Clientes con más recaudación</Text>
          {datos.topClientes.length === 0 ? (
            <Text style={[styles.cellText, { color: MUTED }]}>Sin pagos confirmados en este rango.</Text>
          ) : (
            <>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.colLabel]}>Cliente</Text>
                <Text style={[styles.tableHeaderCell, styles.colCount]}>Pagos</Text>
                <Text style={[styles.tableHeaderCell, styles.colMonto]}>Recaudado</Text>
              </View>
              {datos.topClientes.map((c) => (
                <View style={styles.tableRow} key={c.id}>
                  <Text style={[styles.cellText, styles.colLabel]}>{c.nombre}</Text>
                  <Text style={[styles.cellText, styles.colCount]}>{c.count}</Text>
                  <Text style={[styles.cellText, styles.colMonto]}>{currency(c.monto)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View break>
          <Text style={styles.sectionTitle}>Recaudado vs. gastos por periodo</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colPeriodo]}>Periodo</Text>
            <Text style={[styles.tableHeaderCell, styles.colValorTrend]}>Recaudado</Text>
            <Text style={[styles.tableHeaderCell, styles.colValorTrend]}>Gastos</Text>
          </View>
        </View>
        {datos.puntosPeriodo.map((p) => (
          <View style={styles.tableRow} key={p.key}>
            <Text style={[styles.cellText, styles.colPeriodo]}>{p.label}</Text>
            <Text style={[styles.cellText, styles.colValorTrend]}>{currency(p.recaudado)}</Text>
            <Text style={[styles.cellText, styles.colValorTrend]}>{currency(p.gastos)}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          {businessInfo.nombre} — Reporte generado desde el panel administrativo
        </Text>
      </Page>
    </Document>
  );
}
