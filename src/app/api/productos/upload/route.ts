import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { requiereNivel } from "@/lib/alcance";

// Mismo patrón que /api/servicios/evidencia/upload -- el store de Blob es
// público, así que el límite real de qué se puede subir lo pone este
// endpoint, no Vercel. "archivo" es el descargable de la tienda (.xlsx,
// .exe, .zip...) -- techo generoso porque un instalador de escritorio
// puede pesar bastante más que una plantilla de Excel.
const MAX_IMAGEN_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_ARCHIVO_BYTES = 300 * 1024 * 1024; // 300MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        let tipo: "imagen" | "archivo" = "imagen";
        try {
          const payload = JSON.parse(clientPayloadRaw ?? "{}") as { tipo?: "imagen" | "archivo" };
          tipo = payload.tipo === "archivo" ? "archivo" : "imagen";
        } catch {
          throw new Error("Solicitud de subida inválida.");
        }

        const puede = (await requiereNivel("Productos", "Crear")) || (await requiereNivel("Productos", "Editar"));
        if (!puede) {
          throw new Error("No tienes permiso para subir archivos de productos.");
        }

        return {
          allowedContentTypes: tipo === "archivo" ? ["*/*"] : ["image/*"],
          maximumSizeInBytes: tipo === "archivo" ? MAX_ARCHIVO_BYTES : MAX_IMAGEN_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
