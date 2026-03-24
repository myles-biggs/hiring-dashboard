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
          select: { role: true },
        });
        session.user.role = dbUser?.role ?? Role.HIRING_MANAGER;
      }
      return session;
    },
    async signIn({ user }) {
      if (!user.email) return false;

      const hrEmails = (process.env.HR_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const primaryApprover = process.env.APPROVER_PRIMARY_EMAIL ?? "";
      const backupApprover = process.env.APPROVER_BACKUP_EMAIL ?? "";

      let role: Role = Role.HIRING_MANAGER;
      if (hrEmails.includes(user.email)) role = Role.HR;
      else if ([primaryApprover, backupApprover].filter(Boolean).includes(user.email))
        role = Role.APPROVER;

      await prisma.user.upsert({
        where: { email: user.email },
        update: { role },
        create: {
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          role,
        },
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
