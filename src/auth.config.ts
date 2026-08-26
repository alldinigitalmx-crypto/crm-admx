import type { NextAuthConfig } from "next-auth";
import { encode as defaultEncode } from "next-auth/jwt";

// "Mantener sesión iniciada": el techo del cookie (SESSION_MAX_AGE, lo que
// dura físicamente antes de que el navegador lo borre) tiene que ser al
// menos tan largo como la sesión "recordada" más larga -- si no, el
// cookie se borraría antes de que el JWT de adentro expirara. La duración
// que de verdad se respeta es la del JWT (su "exp"), que encode() de abajo
// calcula por sesión según si se marcó el check o no.
//
// Este archivo (a diferencia de auth.ts) es el que también usa
// src/proxy.ts para proteger /admin y /portal en cada request — por eso
// esta configuración de sesión vive aquí y no en auth.ts: si solo
// estuviera en auth.ts, el proxy usaría una instancia de NextAuth
// distinta con la sesión por defecto (30 días fijos, sin "recordar"), y
// el checkbox del login nunca se respetaría al navegar dentro de /admin.
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 días — techo del cookie
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 90; // 90 días — con el check marcado
const SIN_RECORDAR_MAX_AGE = 60 * 60 * 12; // 12 horas — sin marcar

export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: {
    // El encode() de Auth.js por defecto siempre calcula el "exp" como
    // now + maxAge (el maxAge fijo de arriba), ignorando cualquier "exp"
    // que uno le ponga al token -- por eso hace falta este encode a la
    // medida: lee token.remember (guardado por el callback jwt() de
    // abajo) y con eso decide cuánto dura de verdad esta sesión.
    async encode(params) {
      const maxAge = params.token?.remember ? REMEMBER_MAX_AGE : SIN_RECORDAR_MAX_AGE;
      return defaultEncode({ ...params, maxAge });
    },
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const role = auth?.user ? (auth.user as { role?: string }).role : undefined;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnPortal =
        nextUrl.pathname.startsWith("/portal") && nextUrl.pathname !== "/portal/login";

      if (isOnAdmin) return role === "admin";
      if (isOnPortal) {
        if (role === "cliente") return true;
        return Response.redirect(new URL("/portal/login", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.remember = (user as { remember?: boolean }).remember ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "cliente";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
