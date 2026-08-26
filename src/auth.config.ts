import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
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
