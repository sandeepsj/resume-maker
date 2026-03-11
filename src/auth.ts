import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { clientPromise } from "@/lib/mongodb";
import { authConfig } from "@/auth.config";

// Full server-side config — includes DB adapter for storing users/accounts.
// JWT strategy: sessions are JWTs in cookies, no DB session lookup.
// IMPORTANT: do NOT spread authConfig.callbacks here — the `authorized`
// callback is only for the proxy/middleware. Including it in server-side
// auth() calls causes it to run mid-decode and return null sessions.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  callbacks: {
    // Embed user.id into the JWT on first sign-in
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    // Expose user.id from the JWT on the session object
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
