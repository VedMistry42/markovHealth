import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"
import type { Session } from "next-auth"
import { db, hashPassword } from "@/lib/db"

export type UserRole = "patient" | "researcher"

declare module "next-auth" {
  interface User { role: UserRole; phone?: string; story?: string }
  interface Session {
    user: { id: string; email: string; name: string; role: UserRole; phone: string; story: string }
  }
}
declare module "next-auth/jwt" {
  interface JWT { role: UserRole; id: string; phone: string; story: string }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = db.user.findByEmail(credentials.email)
        if (!user) return null
        if (user.passwordHash !== hashPassword(credentials.password)) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, story: user.story }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role  = (user as { role: UserRole }).role
        token.id    = user.id
        token.name  = user.name ?? ""
        token.phone = (user as { phone?: string }).phone ?? ""
        token.story = (user as { story?: string }).story ?? ""
      }
      return token
    },
    session({ session, token }: { session: Session; token: JWT }) {
      session.user.role  = token.role
      session.user.id    = token.id
      session.user.name  = (token.name as string) ?? ""
      session.user.phone = token.phone ?? ""
      session.user.story = token.story ?? ""
      return session
    },
  },
  pages: { signIn: "/", error: "/" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 4 },
  secret: process.env.NEXTAUTH_SECRET,
}
