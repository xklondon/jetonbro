import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/application/db";
import { deliverMail } from "@/application/mail";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Email({
      server: process.env.EMAIL_SERVER || "smtp://127.0.0.1:1025",
      from: process.env.EMAIL_FROM ?? "JetonBro <noreply@localhost>",
      maxAge: 60 * 60,
      sendVerificationRequest: async ({ identifier, url }) => {
        await deliverMail({
          to: identifier,
          kind: "magic-link",
          subject: "Sign in to JetonBro",
          text: `Open this link to sign in to JetonBro:\n${url}\n\nThis link expires. JetonBro records virtual jetons only; they have no built-in cash value.`,
          url,
        });
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.email = user.email;
      session.user.name = user.name;
      return session;
    },
  },
});
