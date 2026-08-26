import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { requiereNivelServicio } from "@/lib/alcance";

// Techos generosos pero acotados -- el store de Blob es público (para que
// el cliente vea la evidencia sin iniciar sesión), así que el límite real
// de qué se puede subir lo pone este endpoint, no Vercel.
const MAX_IMAGEN_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        let servicioId: number | null = null;
        let tipo: "imagen" | "video" = "imagen";
        try {
          const payload = JSON.parse(clientPayloadRaw ?? "{}") as {
            servicioId?: number;
            tipo?: "imagen" | "video";
          };
          servicioId = payload.servicioId ?? null;
          tipo = payload.tipo === "video" ? "video" : "imagen";
        } catch {
          throw new Error("Solicitud de subida inválida.");
        }

        if (!servicioId || !(await requiereNivelServicio(servicioId, "Editar"))) {
          throw new Error("No tienes permiso para subir evidencia de este proyecto.");
        }

        return {
          allowedContentTypes: tipo === "video" ? ["video/*"] : ["image/*"],
          maximumSizeInBytes: tipo === "video" ? MAX_VIDEO_BYTES : MAX_IMAGEN_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
