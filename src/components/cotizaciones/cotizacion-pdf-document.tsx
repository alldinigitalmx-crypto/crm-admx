import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Image, Link, StyleSheet } from "@react-pdf/renderer";

import { businessInfo } from "@/lib/business-info";

const logoDataUri = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "admx-logo-ink.png"))
  .toString("base64")}`;

const INK = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const ACCENT = "#2563eb";
const PANEL = "#f9fafb";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: INK },

  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  logo: { width: 56, marginBottom: 6 },
  companyName: { fontSize: 18, fontWeight: 700, letterSpacing: 0.5 },
  companyTagline: { fontSize: 9, color: MUTED, marginTop: 2 },
  whatsapp: { fontSize: 8, color: "#374151", marginTop: 8 },
  whatsappLink: { fontSize: 8, color: ACCENT },

  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  metaLine: { fontSize: 9, marginTop: 6, color: "#374151" },
  metaLabel: { fontWeight: 700 },

  divider: { borderBottomWidth: 2, borderBottomColor: INK, marginTop: 16, marginBottom: 18 },

  twoColRow: { flexDirection: "row", marginBottom: 18 },
  sectionBox: { flex: 1 },
  sectionBoxSpacer: { width: 16 },
  sectionHeader: {
    backgroundColor: INK,
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  sectionLine: { fontSize: 9, color: "#374151", marginBottom: 2 },
  sectionLineLabel: { fontWeight: 700, color: INK },

  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: INK,
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  colNum: { width: "6%" },
  colDesc: { width: "44%", paddingRight: 6 },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "16%" },
  colPrice: { width: "12%", textAlign: "right" },
  colSubtotal: { width: "12%", textAlign: "right" },
  cellText: { fontSize: 8.5, lineHeight: 1.4 },

  totalRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "stretch", marginTop: 18 },
  totalBar: { width: 3, backgroundColor: ACCENT, marginRight: 10 },
  totalText: { fontSize: 14, fontWeight: 700, paddingVertical: 4 },

  pagoRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  paidBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#15803d",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  cuentaBox: { alignItems: "flex-end" },
  cuentaLine: { fontSize: 9, color: "#374151", marginTop: 2 },
  cuentaLineLabel: { fontWeight: 700, color: INK },
  cuentaPendiente: { fontSize: 9, color: "#b45309", marginTop: 2, fontWeight: 700 },

  paymentsRow: { flexDirection: "row", marginTop: 26 },
  paymentCol: {
    flex: 1,
    backgroundColor: PANEL,
    padding: 10,
    marginRight: 10,
    borderRadius: 3,
  },
  paymentColLast: { marginRight: 0 },
  paymentTitle: { fontSize: 9, fontWeight: 700, marginBottom: 6 },
  paymentLine: { fontSize: 8, color: "#374151", marginBottom: 2 },
  paymentLabel: { fontWeight: 700, color: INK },
  paymentLink: { fontSize: 8, color: ACCENT, marginTop: 2 },

  termsBox: { backgroundColor: PANEL, padding: 12, marginTop: 22, borderRadius: 3 },
  termsTitle: { fontSize: 9, fontWeight: 700, marginBottom: 8 },
  termsRow: { flexDirection: "row" },
  termsCol: { flex: 1 },
  termsItem: { fontSize: 8, color: "#374151", marginBottom: 4, lineHeight: 1.4 },
  termsLabel: { fontWeight: 700, color: INK },

  footer: { marginTop: 32, textAlign: "center", fontSize: 10, color: MUTED },
});

// Mismo criterio que formatCurrency() (src/lib/format.ts): MXN no lleva
// sufijo, USD/COP sí, para no confundirlo con pesos ya que los tres usan
// el símbolo "$".
const currency = (n: number, moneda?: string | null) => {
  const monto = `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return moneda && moneda !== "MXN" ? `${monto} ${moneda}` : monto;
};

const fechaFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const fechaCorta = (d: Date) => fechaFormatter.format(new Date(d));

export type CotizacionPdfProps = {
  cotizacion: {
    id: number;
    status: string;
    descripcion: string | null;
    detalles: string | null;
    montoSubtotal: number;
    descuentoTipo: string | null;
    descuentoValor: number | null;
    descuentoMotivo: string | null;
    montoTotal: number;
    moneda: string | null;
    fechaEmision: Date;
    fechaVencimiento: Date | null;
  };
  pago: {
    pagada: boolean;
    montoPagado: number;
    montoPendiente: number;
    fechaPago: Date | null;
  };
  servicio: {
    descripcion: string;
    detalles: string | null;
    status: string;
    fechaInicio: Date;
    fechaFin: Date | null;
  } | null;
  cliente: { nombre: string; email: string | null };
};

export function CotizacionPdfDocument({ cotizacion, pago, servicio, cliente }: CotizacionPdfProps) {
  const montoDescuento =
    cotizacion.descuentoTipo === "Porcentaje"
      ? cotizacion.montoSubtotal * ((cotizacion.descuentoValor ?? 0) / 100)
      : (cotizacion.descuentoValor ?? 0);
  const descripcion = servicio?.descripcion ?? cotizacion.descripcion ?? "";
  const detalles = servicio?.detalles ?? cotizacion.detalles;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
            <Image src={logoDataUri} style={styles.logo} />
            <Text style={styles.companyName}>{businessInfo.nombre}</Text>
            <Text style={styles.companyTagline}>{businessInfo.eslogan}</Text>
            <Text style={styles.whatsapp}>WhatsApp: {businessInfo.whatsapp}</Text>
            <Link src={businessInfo.whatsappLink} style={styles.whatsappLink}>
              Click para chatear
            </Link>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>COTIZACIÓN</Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Fecha: </Text>
              {fechaCorta(cotizacion.fechaEmision)}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Cotización #: </Text>
              {cotizacion.id}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.twoColRow}>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeader}>Cliente</Text>
            <Text style={styles.sectionLine}>{cliente.nombre}</Text>
            {cliente.email && <Text style={styles.sectionLine}>{cliente.email}</Text>}
          </View>

          <View style={styles.sectionBoxSpacer} />

          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeader}>Proyecto</Text>
            <Text style={styles.sectionLine}>
              <Text style={styles.sectionLineLabel}>Nombre: </Text>
              {descripcion}
            </Text>
            <Text style={styles.sectionLine}>
              <Text style={styles.sectionLineLabel}>Status: </Text>
              {servicio ? servicio.status : "En negociación"}
            </Text>
            {servicio && (
              <Text style={styles.sectionLine}>
                <Text style={styles.sectionLineLabel}>Inicio: </Text>
                {fechaCorta(servicio.fechaInicio)}
                {servicio.fechaFin ? ` — Entrega: ${fechaCorta(servicio.fechaFin)}` : ""}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.tableHeaderRow}>
          <Text style={styles.colNum}>#</Text>
          <Text style={styles.colDesc}>Descripción</Text>
          <Text style={styles.colQty}>Cantidad</Text>
          <Text style={styles.colUnit}>Unidad</Text>
          <Text style={styles.colPrice}>Precio Unit.</Text>
          <Text style={styles.colSubtotal}>Sub Total</Text>
        </View>

        <View style={styles.tableRow}>
          <Text style={[styles.colNum, styles.cellText]}>1</Text>
          <Text style={[styles.colDesc, styles.cellText]}>{detalles || descripcion}</Text>
          <Text style={[styles.colQty, styles.cellText]}>1</Text>
          <Text style={[styles.colUnit, styles.cellText]}>Servicio</Text>
          <Text style={[styles.colPrice, styles.cellText]}>
            {currency(cotizacion.montoSubtotal, cotizacion.moneda)}
          </Text>
          <Text style={[styles.colSubtotal, styles.cellText]}>
            {currency(cotizacion.montoSubtotal, cotizacion.moneda)}
          </Text>
        </View>

        {cotizacion.descuentoTipo && (
          <View style={styles.tableRow}>
            <Text style={[styles.colNum, styles.cellText]} />
            <Text style={[styles.colDesc, styles.cellText]}>
              Descuento
              {cotizacion.descuentoMotivo ? ` — ${cotizacion.descuentoMotivo}` : ""}
              {cotizacion.descuentoTipo === "Porcentaje" ? ` (${cotizacion.descuentoValor}%)` : ""}
            </Text>
            <Text style={[styles.colQty, styles.cellText]}>—</Text>
            <Text style={[styles.colUnit, styles.cellText]}>—</Text>
            <Text style={[styles.colPrice, styles.cellText]}>—</Text>
            <Text style={[styles.colSubtotal, styles.cellText]}>
              -{currency(montoDescuento, cotizacion.moneda)}
            </Text>
          </View>
        )}

        <View style={styles.totalRow}>
          <View style={styles.totalBar} />
          <Text style={styles.totalText}>
            Total: {currency(cotizacion.montoTotal, cotizacion.moneda)}
          </Text>
        </View>

        <View style={styles.pagoRow}>
          {pago.pagada ? (
            <Text style={styles.paidBadge}>
              ✓ PAGADO{pago.fechaPago ? ` — ${fechaCorta(pago.fechaPago)}` : ""}
            </Text>
          ) : pago.montoPagado > 0 ? (
            <View style={styles.cuentaBox}>
              <Text style={styles.cuentaLine}>
                <Text style={styles.cuentaLineLabel}>A cuenta: </Text>
                {currency(pago.montoPagado, cotizacion.moneda)}
              </Text>
              <Text style={styles.cuentaPendiente}>
                Saldo pendiente: {currency(pago.montoPendiente, cotizacion.moneda)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.paymentsRow}>
          <View style={styles.paymentCol}>
            <Text style={styles.paymentTitle}>Transferencia bancaria</Text>
            <Text style={styles.paymentLine}>
              <Text style={styles.paymentLabel}>Banco: </Text>
              {businessInfo.banco.nombre}
            </Text>
            <Text style={styles.paymentLine}>
              <Text style={styles.paymentLabel}>Cuenta: </Text>
              {businessInfo.banco.cuenta}
            </Text>
            <Text style={styles.paymentLine}>
              <Text style={styles.paymentLabel}>CLABE: </Text>
              {businessInfo.banco.clabe}
            </Text>
            <Text style={styles.paymentLine}>
              <Text style={styles.paymentLabel}>SWIFT: </Text>
              {businessInfo.banco.swift}
            </Text>
          </View>

          <View style={styles.paymentCol}>
            <Text style={styles.paymentTitle}>Binance</Text>
            <Text style={styles.paymentLine}>
              <Text style={styles.paymentLabel}>Correo: </Text>
              {businessInfo.binance.correo}
            </Text>
          </View>

          <View style={[styles.paymentCol, styles.paymentColLast]}>
            <Text style={styles.paymentTitle}>PayPal</Text>
            <Text style={styles.paymentLine}>Haz click en el enlace para pagar</Text>
            <Link src={businessInfo.paypal.link} style={styles.paymentLink}>
              {businessInfo.paypal.link}
            </Link>
          </View>
        </View>

        <View style={styles.termsBox}>
          <Text style={styles.termsTitle}>TÉRMINOS Y CONDICIONES</Text>
          <View style={styles.termsRow}>
            <View style={styles.termsCol}>
              <Text style={styles.termsItem}>
                <Text style={styles.termsLabel}>Forma de pago: </Text>
                50% anticipo y 50% contra entrega.
              </Text>
              <Text style={styles.termsItem}>
                <Text style={styles.termsLabel}>Validez: </Text>
                15 días calendario
                {cotizacion.fechaVencimiento
                  ? ` (vence el ${fechaCorta(cotizacion.fechaVencimiento)})`
                  : ""}
                .
              </Text>
              <Text style={styles.termsItem}>
                <Text style={styles.termsLabel}>Garantía: </Text>
                6 meses por defectos de programación.
              </Text>
            </View>
            <View style={styles.termsCol}>
              <Text style={styles.termsItem}>
                <Text style={styles.termsLabel}>Métodos: </Text>
                Transferencia bancaria, Binance o PayPal.
              </Text>
              <Text style={styles.termsItem}>
                <Text style={styles.termsLabel}>Entregables: </Text>
                Código fuente, manuales y soporte.
              </Text>
              <Text style={styles.termsItem}>
                <Text style={styles.termsLabel}>Cambios: </Text>
                Pueden generar costos adicionales — se documentan como órdenes de cambio.
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>¡Gracias por su confianza!</Text>
      </Page>
    </Document>
  );
}
