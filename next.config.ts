import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos de evidencia/comprobantes se suben como data URL (base64) vía
      // Server Actions, no como multipart real — el límite por defecto (1MB) se
      // queda corto para una foto de celular normal.
      bodySizeLimit: "10mb",
    },
  },
  // Cabeceras de seguridad de por vida (antes no había ninguna, ni las
  // pone Vercel por defecto). No se agrega una Content-Security-Policy
  // estricta aquí -- necesita probarse a fondo para no romper los scripts
  // inline de hidratación de Next, así que queda como mejora futura.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nadie puede meter /login ni /admin en un <iframe> de otro
          // sitio (clickjacking: un overlay invisible encima del login
          // real para robar clics/credenciales).
          { key: "X-Frame-Options", value: "DENY" },
          // El navegador no debe "adivinar" el tipo de un archivo distinto
          // al que declara Content-Type -- evita que un archivo subido
          // (ej. comprobante de pago) se interprete como HTML/JS.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No filtrar la URL completa (con tokens de cotización/portal)
          // como referrer al navegar a un sitio externo.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
