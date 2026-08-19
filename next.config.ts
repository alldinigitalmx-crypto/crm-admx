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
};

export default nextConfig;
