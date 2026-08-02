import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "admin-login",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
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
        };
      },
    }),
    Credentials({
      id: "cliente-login",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
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