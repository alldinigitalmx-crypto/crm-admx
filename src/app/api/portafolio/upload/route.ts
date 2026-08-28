import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { requiereNivel } from "@/lib/alcance";

// Mismo patrón que /api/servicios/evidencia/upload -- imágenes de
// portafolio directo del navegador a Vercel Blob (sin pasar por el
// límite de 1MB de las Server Actions), gateado por permiso de módulo en
// vez de por servicio (el portafolio no cuelga de ningún servicio).
const MAX_IMAGEN_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await requiereNivel("Portafolio", "Editar"))) {
          throw new Error("No tienes permiso para subir imágenes de portafolio.");
        }

        return {
          allowedContentTypes: ["image/*"],
          maximumSizeInBytes: MAX_IMAGEN_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
