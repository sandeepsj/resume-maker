import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { clientPromise } from "@/lib/mongodb";
import { authConfig } from "@/auth.config";

// Full server-side config — includes DB adapter for storing users/accounts.
// JWT session strategy: sessions are JWTs in cookies (no DB lookup needed),
// but users and OAuth accounts are still persisted in MongoDB.
// Only import this in server components and API routes — never in proxy/middleware.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  callbacks: {
    ...authConfig.callbacks,
    // Embed user.id into the JWT token when it is first created
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Expose user.id from the JWT token on the session object
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
