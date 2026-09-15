import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/application/db";
import { sendMagicLinkEmail } from "@/application/mail";
import { resolveAuthRedirect, rewriteMagicLinkUrl } from "@/application/auth-urls";

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
    {
      id: "email",
      type: "email",
      name: "Email",
      maxAge: 60 * 60,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMagicLinkEmail(identifier, rewriteMagicLinkUrl(url));
      },
    },
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.email = user.email;
      session.user.name = user.name;
      return session;
    },
    redirect({ url, baseUrl }) {
      return resolveAuthRedirect(url, baseUrl);
    },
  },
});
