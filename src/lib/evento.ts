import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function registrarEvento(
  tipo: string,
  entidadTipo: string,
  entidadId: number,
  payload: Prisma.InputJsonValue
) {
  await prisma.eventoSistema.create({
    data: { tipo, entidadTipo, entidadId, payload },
  });
}
