import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 12,
  },
  brand: { fontSize: 18, fontWeight: 700, color: "#1d4ed8" },
  small: { fontSize: 9, color: "#6b7280" },
  section: { marginBottom: 16 },
  label: { fontSize: 9, color: "#6b7280", marginBottom: 2 },
  value: { fontSize: 11, marginBottom: 4 },
  table: { marginTop: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#1d4ed8",
  },
  totalLabel: { fontSize: 13, fontWeight: 700 },
  status: {
    fontSize: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    alignSelf: "flex-end",
  },
});

const currency = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;

const fecha = (d: Date) => new Date(d).toLocaleDateString("es-MX", { timeZone: "UTC" });

export type CotizacionPdfProps = {
  cotizacion: {
    id: number;
    status: string;
    montoSubtotal: number;
    descuentoTipo: string | null;
    descuentoValor: number | null;
    descuentoMotivo: string | null;
    montoTotal: number;
    fechaEmision: Date;
    fechaVencimiento: Date | null;
  };
  servicio: { descripcion: string; detalles: string | null };
  cliente: { nombre: string; email: string | null };
};

export function CotizacionPdfDocument({ cotizacion, servicio, cliente }: CotizacionPdfProps) {
  const montoDescuento =
    cotizacion.descuentoTipo === "Porcentaje"
      ? cotizacion.montoSubtotal * ((cotizacion.descuentoValor ?? 0) / 100)
      : (cotizacion.descuentoValor ?? 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>ADMX DEV</Text>
            <Text style={styles.small}>
              Cotización #{String(cotizacion.id).padStart(4, "0")}
            </Text>
          </View>
          <View>
            <Text style={styles.status}>{cotizacion.status}</Text>
            <Text style={[styles.small, { marginTop: 4 }]}>
              Emitida: {fecha(cotizacion.fechaEmision)}
            </Text>
            {cotizacion.fechaVencimiento && (
              <Text style={styles.small}>Vence: {fecha(cotizacion.fechaVencimiento)}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>CLIENTE</Text>
          <Text style={styles.value}>{cliente.nombre}</Text>
          {cliente.email && <Text style={styles.small}>{cliente.email}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>SERVICIO</Text>
          <Text style={styles.value}>{servicio.descripcion}</Text>
          {servicio.detalles && <Text style={styles.small}>{servicio.detalles}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text>Subtotal</Text>
            <Text>{currency(cotizacion.montoSubtotal)}</Text>
          </View>
          {cotizacion.descuentoTipo && (
            <View style={styles.row}>
              <Text>
                Descuento (
                {cotizacion.descuentoTipo === "Porcentaje"
                  ? `${cotizacion.descuentoValor}%`
                  : currency(cotizacion.descuentoValor ?? 0)}
                ){cotizacion.descuentoMotivo ? ` — ${cotizacion.descuentoMotivo}` : ""}
              </Text>
              <Text>-{currency(montoDescuento)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalLabel}>{currency(cotizacion.montoTotal)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
