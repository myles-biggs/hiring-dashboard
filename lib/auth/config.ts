import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { Role } from "@prisma/client";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/utils/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, isApprover: true },
        });
        session.user.role = dbUser?.role ?? Role.HIRING_MANAGER;
        session.user.isApprover = dbUser?.isApprover ?? false;
      }
      return session;
    },
    async signIn({ user }) {
      if (!user.email) return false;

      const taEmails = (process.env.HR_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      let role: Role = Role.HIRING_MANAGER;
      if (adminEmails.includes(user.email)) role = Role.ADMIN;
      else if (taEmails.includes(user.email)) role = Role.TALENT_ACQUISITION;

      // Update only — never create. The Prisma adapter handles user creation.
      // On first sign-in the user doesn't exist yet so updateMany is a no-op.
      await prisma.user.updateMany({
        where: { email: user.email },
        data: { role },
      });

      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "database",
  },
};
