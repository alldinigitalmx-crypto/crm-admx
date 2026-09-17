import QRCode from "qrcode";

import { businessInfo } from "@/lib/business-info";

// El link de PayPal es fijo (businessInfo.paypal.link), así que el QR
// también lo es -- se genera una sola vez por proceso en vez de en cada
// solicitud de PDF.
let cached: Promise<string> | null = null;

export function paypalQrDataUri(): Promise<string> {
  if (!cached) {
    cached = QRCode.toDataURL(businessInfo.paypal.link, {
      margin: 1,
      width: 240,
      color: { dark: "#003087", light: "#ffffff" },
    });
  }
  return cached;
}
