import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encode as defaultEncode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

// "Mantener sesión iniciada": el techo del cookie (SESSION_MAX_AGE, lo que
// dura físicamente antes de que el navegador lo borre) tiene que ser al
// menos tan largo como la sesión "recordada" más larga -- si no, el
// cookie se borraría antes de que el JWT de adentro expirara. La duración
// que de verdad se respeta es la del JWT (su "exp"), que encode() de abajo
// calcula por sesión según si se marcó el check o no.
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 días — techo del cookie
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 90; // 90 días — con el check marcado
const SIN_RECORDAR_MAX_AGE = 60 * 60 * 12; // 12 horas — sin marcar (default de antes)

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: {
    // El encode() de Auth.js por defecto siempre calcula el "exp" como
    // now + maxAge (el maxAge fijo de arriba), ignorando cualquier "exp"
    // que uno le ponga al token -- por eso hace falta este encode a la
    // medida: lee token.remember (que puso el callback jwt() en
    // auth.config.ts) y con eso decide cuánto dura de verdad esta sesión.
    async encode(params) {
      const maxAge = params.token?.remember ? REMEMBER_MAX_AGE : SIN_RECORDAR_MAX_AGE;
      return defaultEncode({ ...params, maxAge });
    },
  },
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

        const ok = await bcrypt.compare(
          credentials.password as string,
          usuario.passwordHash
        );
        if (!ok) return null;

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

        const ok = await bcrypt.compare(
          credentials.password as string,
          cliente.passwordHash
        );
        if (!ok) return null;

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