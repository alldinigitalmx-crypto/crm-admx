import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// Freno anti fuerza bruta: sin esto, nada impedía probar contraseñas sin
// límite contra un correo real. Se guarda en la fila del usuario/cliente
// (no en memoria del proceso) porque en serverless cada intento puede
// caer en una instancia distinta -- un contador en memoria no serviría
// de nada. Tras UMBRAL_INTENTOS fallidos seguidos, se bloquea por
// DURACION_BLOQUEO_MS sin ni siquiera comparar el hash (bcrypt ya es
// lento de por sí, pero esto corta el intento antes de gastarlo).
const UMBRAL_INTENTOS = 5;
const DURACION_BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

// La configuración de sesión (duración, "recordar" el check) vive en
// auth.config.ts, no aquí -- así la comparte también src/proxy.ts, que
// arma su propia instancia de NextAuth solo con authConfig para proteger
// /admin y /portal en cada request.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "admin-login",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
        remember: { label: "Mantener sesión iniciada", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email as string },
        });
        if (!usuario || !usuario.activo) return null;

        if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) return null;

        const ok = await bcrypt.compare(
          credentials.password as string,
          usuario.passwordHash
        );
        if (!ok) {
          const intentos = usuario.intentosFallidos + 1;
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
              intentosFallidos: intentos,
              bloqueadoHasta:
                intentos >= UMBRAL_INTENTOS
                  ? new Date(Date.now() + DURACION_BLOQUEO_MS)
                  : usuario.bloqueadoHasta,
            },
          });
          return null;
        }

        if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null },
          });
        }

        return {
          id: String(usuario.id),
          email: usuario.email,
          name: usuario.nombre,
          role: "admin",
          remember: credentials.remember === "true" || credentials.remember === true,
        };
      },
    }),
    Credentials({
      id: "cliente-login",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
        remember: { label: "Mantener sesión iniciada", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const cliente = await prisma.cliente.findFirst({
          where: { email: credentials.email as string, portalActivo: true },
        });
        if (!cliente || !cliente.passwordHash) return null;

        if (cliente.bloqueadoHasta && cliente.bloqueadoHasta > new Date()) return null;

        const ok = await bcrypt.compare(
          credentials.password as string,
          cliente.passwordHash
        );
        if (!ok) {
          const intentos = cliente.intentosFallidos + 1;
          await prisma.cliente.update({
            where: { id: cliente.id },
            data: {
              intentosFallidos: intentos,
              bloqueadoHasta:
                intentos >= UMBRAL_INTENTOS
                  ? new Date(Date.now() + DURACION_BLOQUEO_MS)
                  : cliente.bloqueadoHasta,
            },
          });
          return null;
        }

        if (cliente.intentosFallidos > 0 || cliente.bloqueadoHasta) {
          await prisma.cliente.update({
            where: { id: cliente.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null },
          });
        }

        return {
          id: String(cliente.id),
          email: cliente.email,
          name: cliente.nombre,
          role: "cliente",
          remember: credentials.remember === "true" || credentials.remember === true,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if ((user as { role?: string }).role === "cliente") {
        await prisma.cliente.update({
          where: { id: Number(user.id) },
          data: { ultimoAccesoPortal: new Date() },
        });
      }
    },
  },
});