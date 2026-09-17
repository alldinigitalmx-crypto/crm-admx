import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Image, Link, StyleSheet } from "@react-pdf/renderer";

import { businessInfo } from "@/lib/business-info";

const logoDataUri = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "admx-logo-ink.png"))
  .toString("base64")}`;

const INK = "#18181f";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
// Azul clásico (no el indigo/morado --primary del resto de la app) -- en
// el documento que se manda a clientes se ve mejor un azul inconfundible.
const ACCENT = "#2563eb";
const ACCENT_DARK = "#1d4ed8";

const styles = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingTop: 36, paddingBottom: 36, fontSize: 9, fontFamily: "Helvetica", color: INK },

  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  headerLeft: { flexDirection: "column" },
  logo: { width: 62, marginBottom: 8 },
  tagline: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 1, color: MUTED, textTransform: "uppercase" },
  whatsapp: { fontFamily: "Courier", fontSize: 8, color: ACCENT_DARK, marginTop: 6 },

  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 22, fontWeight: 700, letterSpacing: -0.2 },
  metaTable: { marginTop: 10, minWidth: 170 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingVertical: 5,
  },
  metaLabel: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 0.8, color: MUTED, textTransform: "uppercase" },
  metaValue: { fontFamily: "Courier", fontSize: 8.5, fontWeight: 700, color: INK },

  accentBand: { height: 4, backgroundColor: ACCENT, marginTop: 14, marginBottom: 18 },
  accentBandTight: { height: 4, backgroundColor: ACCENT, marginTop: 10, marginBottom: 16 },

  twoColRow: { flexDirection: "row", marginBottom: 16 },
  colBox: { flex: 1, paddingRight: 14, borderRightWidth: 1, borderRightColor: BORDER },
  colBoxRight: { flex: 1, paddingLeft: 14 },
  colLabel: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 1, color: ACCENT_DARK, textTransform: "uppercase", marginBottom: 5 },
  colValue: { fontSize: 11.5, fontWeight: 700, color: INK },
  colMuted: { fontFamily: "Courier", fontSize: 8, color: MUTED, marginTop: 3 },

  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eef0f3",
    paddingVertical: 9,
  },
  colNum: { width: "6%" },
  colDesc: { width: "44%", paddingRight: 8 },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "16%" },
  colPrice: { width: "12%", textAlign: "right" },
  colSubtotal: { width: "12%", textAlign: "right" },
  th: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 0.8, color: MUTED, textTransform: "uppercase" },
  cellTitle: { fontSize: 9, fontWeight: 700, color: INK },
  cellMuted: { fontFamily: "Courier", fontSize: 8, color: MUTED, marginTop: 2, lineHeight: 1.4 },
  cellText: { fontFamily: "Courier", fontSize: 8.5, color: "#374151" },
  cellTextBold: { fontFamily: "Courier", fontSize: 8.5, fontWeight: 700, color: INK },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totalsBox: { width: 260 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    fontFamily: "Courier",
    fontSize: 8.5,
    color: "#374151",
  },
  totalLineBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: ACCENT,
    color: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  totalBarLabel: { fontFamily: "Courier", fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: "#ffffff" },
  totalBarValue: { fontSize: 16, fontWeight: 700, color: "#ffffff" },
  anticipoLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 0,
    paddingVertical: 7,
    paddingHorizontal: 12,
    fontFamily: "Courier",
    fontSize: 8.5,
    color: "#374151",
  },
  anticipoValue: { fontWeight: 700, color: INK },

  pagoRow: { alignItems: "flex-end", marginTop: 8 },
  paidBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#15803d",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  cuentaBox: { alignItems: "flex-end" },
  cuentaLine: { fontFamily: "Courier", fontSize: 8.5, color: "#374151", marginTop: 2 },
  cuentaLineLabel: { fontWeight: 700, color: INK },
  cuentaPendiente: { fontFamily: "Courier", fontSize: 8.5, color: "#b45309", marginTop: 2, fontWeight: 700 },

  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 0.5, color: MUTED },

  headerRowSimple: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoSmall: { width: 46 },
  headerRightLabel: { fontFamily: "Courier", fontSize: 8, letterSpacing: 0.8, color: MUTED, textTransform: "uppercase" },

  section: { marginTop: 22 },
  sectionLabel: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 1, color: ACCENT_DARK, textTransform: "uppercase", marginBottom: 10 },

  paymentsRow: { flexDirection: "row" },
  paymentCol: { flex: 1, paddingRight: 16, borderRightWidth: 1, borderRightColor: BORDER },
  paymentColLast: { paddingRight: 0, paddingLeft: 16, borderRightWidth: 0 },
  paymentColMid: { paddingLeft: 16 },
  paymentTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 5, color: INK },
  paymentLine: { fontFamily: "Courier", fontSize: 8, color: "#374151", marginBottom: 2 },
  paymentLink: { fontFamily: "Courier", fontSize: 8, color: ACCENT_DARK, marginTop: 2 },
  paypalQr: { width: 58, height: 58, marginBottom: 6 },

  termsGrid: { flexDirection: "row" },
  termsCol: { flex: 1 },
  termsItem: { flexDirection: "row", marginBottom: 8, paddingRight: 20 },
  termsItemLabel: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 0.5, color: MUTED, textTransform: "uppercase", width: 62 },
  termsItemValue: { fontSize: 8.5, color: "#374151", flex: 1, lineHeight: 1.4 },

  signRow: { flexDirection: "row", marginTop: 4 },
  signCol: { flex: 1, paddingRight: 30 },
  signLine: { borderBottomWidth: 1, borderBottomColor: INK, height: 34 },
  signCaption: { fontFamily: "Courier", fontSize: 7.5, letterSpacing: 0.5, color: MUTED, textTransform: "uppercase", marginTop: 6 },
  signValue: { fontSize: 8.5, color: "#374151", marginTop: 3 },
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
    porcentajeAnticipo: number | null;
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
  paypalQr: string;
};

export function CotizacionPdfDocument({ cotizacion, pago, servicio, cliente, paypalQr }: CotizacionPdfProps) {
  const montoDescuento =
    cotizacion.descuentoTipo === "Porcentaje"
      ? cotizacion.montoSubtotal * ((cotizacion.descuentoValor ?? 0) / 100)
      : (cotizacion.descuentoValor ?? 0);
  const descripcion = servicio?.descripcion ?? cotizacion.descripcion ?? "";
  const detalles = servicio?.detalles ?? cotizacion.detalles;
  const folio = `#${String(cotizacion.id).padStart(4, "0")}`;
  const anticipoMonto = cotizacion.porcentajeAnticipo
    ? cotizacion.montoTotal * (cotizacion.porcentajeAnticipo / 100)
    : null;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
            <Image src={logoDataUri} style={styles.logo} />
            <Text style={styles.tagline}>{businessInfo.eslogan}</Text>
            <Link src={businessInfo.whatsappLink} style={styles.whatsapp}>
              WhatsApp {businessInfo.whatsapp}
            </Link>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>Cotización</Text>
            <View style={styles.metaTable}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Folio</Text>
                <Text style={styles.metaValue}>{folio}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Emisión</Text>
                <Text style={styles.metaValue}>{fechaCorta(cotizacion.fechaEmision)}</Text>
              </View>
              {cotizacion.fechaVencimiento && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Vigencia</Text>
                  <Text style={styles.metaValue}>{fechaCorta(cotizacion.fechaVencimiento)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.accentBand} />

        <View style={styles.twoColRow}>
          <View style={styles.colBox}>
            <Text style={styles.colLabel}>Cliente</Text>
            <Text style={styles.colValue}>{cliente.nombre}</Text>
            {cliente.email && <Text style={styles.colMuted}>{cliente.email}</Text>}
          </View>

          <View style={styles.colBoxRight}>
            <Text style={styles.colLabel}>Proyecto</Text>
            <Text style={styles.colValue}>{descripcion}</Text>
            <Text style={styles.colMuted}>
              Status: {servicio ? servicio.status : "En negociación"}
              {servicio
                ? `   Inicio: ${fechaCorta(servicio.fechaInicio)}${
                    servicio.fechaFin ? ` — Entrega: ${fechaCorta(servicio.fechaFin)}` : ""
                  }`
                : ""}
            </Text>
          </View>
        </View>

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.colNum, styles.th]}>#</Text>
          <Text style={[styles.colDesc, styles.th]}>Concepto</Text>
          <Text style={[styles.colQty, styles.th]}>Cant.</Text>
          <Text style={[styles.colUnit, styles.th]}>Unidad</Text>
          <Text style={[styles.colPrice, styles.th]}>P. unitario</Text>
          <Text style={[styles.colSubtotal, styles.th]}>Importe</Text>
        </View>

        <View style={styles.tableRow}>
          <Text style={[styles.colNum, styles.cellText]}>01</Text>
          <View style={styles.colDesc}>
            <Text style={styles.cellTitle}>{descripcion}</Text>
            {detalles && <Text style={styles.cellMuted}>{detalles}</Text>}
          </View>
          <Text style={[styles.colQty, styles.cellText]}>1</Text>
          <Text style={[styles.colUnit, styles.cellText]}>Servicio</Text>
          <Text style={[styles.colPrice, styles.cellTextBold]}>
            {currency(cotizacion.montoSubtotal, cotizacion.moneda)}
          </Text>
          <Text style={[styles.colSubtotal, styles.cellTextBold]}>
            {currency(cotizacion.montoSubtotal, cotizacion.moneda)}
          </Text>
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <Text>Subtotal</Text>
              <Text>{currency(cotizacion.montoSubtotal, cotizacion.moneda)}</Text>
            </View>
            {cotizacion.descuentoTipo && (
              <View style={[styles.totalLine, styles.totalLineBorder]}>
                <Text>
                  Descuento
                  {cotizacion.descuentoMotivo ? ` — ${cotizacion.descuentoMotivo}` : ""}
                  {cotizacion.descuentoTipo === "Porcentaje" ? ` (${cotizacion.descuentoValor}%)` : ""}
                </Text>
                <Text>-{currency(montoDescuento, cotizacion.moneda)}</Text>
              </View>
            )}
            <View style={styles.totalBar}>
              <Text style={styles.totalBarLabel}>Total {cotizacion.moneda ?? "MXN"}</Text>
              <Text style={styles.totalBarValue}>{currency(cotizacion.montoTotal, cotizacion.moneda)}</Text>
            </View>
            {anticipoMonto !== null && (
              <View style={styles.anticipoLine}>
                <Text>Anticipo {cotizacion.porcentajeAnticipo}% para arrancar</Text>
                <Text style={styles.anticipoValue}>{currency(anticipoMonto, cotizacion.moneda)}</Text>
              </View>
            )}
          </View>
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

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            {businessInfo.nombre} · {folio}
          </Text>
          <Text style={styles.footerText}>Página 1 de 2</Text>
        </View>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRowSimple}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
          <Image src={logoDataUri} style={styles.logoSmall} />
          <Text style={styles.headerRightLabel}>
            Cotización {folio} · {cliente.nombre}
          </Text>
        </View>

        <View style={styles.accentBandTight} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Formas de pago</Text>
          <View style={styles.paymentsRow}>
            <View style={styles.paymentCol}>
              <Text style={styles.paymentTitle}>Transferencia {businessInfo.banco.nombre}</Text>
              <Text style={styles.paymentLine}>Cuenta {businessInfo.banco.cuenta}</Text>
              <Text style={styles.paymentLine}>CLABE {businessInfo.banco.clabe}</Text>
              <Text style={styles.paymentLine}>SWIFT {businessInfo.banco.swift}</Text>
            </View>
            <View style={[styles.paymentCol, styles.paymentColMid]}>
              <Text style={styles.paymentTitle}>Binance</Text>
              <Text style={styles.paymentLine}>{businessInfo.binance.correo}</Text>
            </View>
            <View style={[styles.paymentCol, styles.paymentColLast]}>
              <Text style={styles.paymentTitle}>PayPal</Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
              <Image src={paypalQr} style={styles.paypalQr} />
              <Link src={businessInfo.paypal.link} style={styles.paymentLink}>
                {businessInfo.paypal.link.replace("https://", "")}
              </Link>
              <Text style={styles.paymentLine}>Escanea el código o entra al link</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Términos y condiciones</Text>
          <View style={styles.termsGrid}>
            <View style={styles.termsCol}>
              <View style={styles.termsItem}>
                <Text style={styles.termsItemLabel}>Pago</Text>
                <Text style={styles.termsItemValue}>50% anticipo y 50% contra entrega.</Text>
              </View>
              <View style={styles.termsItem}>
                <Text style={styles.termsItemLabel}>Validez</Text>
                <Text style={styles.termsItemValue}>
                  15 días calendario
                  {cotizacion.fechaVencimiento
                    ? ` (vence el ${fechaCorta(cotizacion.fechaVencimiento)})`
                    : ""}
                  .
                </Text>
              </View>
              <View style={styles.termsItem}>
                <Text style={styles.termsItemLabel}>Garantía</Text>
                <Text style={styles.termsItemValue}>6 meses por defectos de programación.</Text>
              </View>
            </View>
            <View style={styles.termsCol}>
              <View style={styles.termsItem}>
                <Text style={styles.termsItemLabel}>Métodos</Text>
                <Text style={styles.termsItemValue}>Transferencia bancaria, Binance o PayPal.</Text>
              </View>
              <View style={styles.termsItem}>
                <Text style={styles.termsItemLabel}>Entregables</Text>
                <Text style={styles.termsItemValue}>Código fuente, manuales y soporte.</Text>
              </View>
              <View style={styles.termsItem}>
                <Text style={styles.termsItemLabel}>Cambios</Text>
                <Text style={styles.termsItemValue}>
                  Se documentan como órdenes de cambio y pueden generar costos adicionales.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Aceptación</Text>
          <View style={styles.signRow}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signCaption}>Firma del cliente</Text>
              <Text style={styles.signValue}>{cliente.nombre}</Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signCaption}>Fecha</Text>
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            {businessInfo.nombre} · {folio}
          </Text>
          <Text style={styles.footerText}>Página 2 de 2</Text>
        </View>
      </Page>
    </Document>
  );
}
