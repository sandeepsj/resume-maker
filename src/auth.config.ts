import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Lightweight config — no DB adapter, edge runtime safe.
// Used by middleware for session token verification only.
// JWT strategy so the edge runtime can verify sessions without a DB call.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthenticated = !!auth?.user;
      const { pathname } = nextUrl;

      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/career") ||
        pathname.startsWith("/resumes") ||
        pathname.startsWith("/settings") ||
        (pathname.startsWith("/api") && !pathname.startsWith("/api/auth"));

      if (isProtected && !isAuthenticated) {
        return false; // NextAuth redirects to signIn page automatically
      }

      return true;
    },
  },
};
