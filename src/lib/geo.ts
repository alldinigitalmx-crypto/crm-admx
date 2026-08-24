import { headers } from "next/headers";

// Vercel agrega el país del visitante (por IP) a cada request sin que haya
// que configurar nada — ver https://vercel.com/docs/edge-network/headers.
// En local (o si el header no viene) no hay forma de saberlo, así que por
// defecto asumimos México para no bloquear nada en desarrollo/pruebas.
export async function paisVisitante(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-vercel-ip-country");
}

export async function esVisitanteDeMexico(): Promise<boolean> {
  const pais = await paisVisitante();
  return pais === null || pais === "MX";
}
