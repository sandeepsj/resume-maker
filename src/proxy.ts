import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Uses the lightweight edge-safe config (no DB adapter, no Node.js modules).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
