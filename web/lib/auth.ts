import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"
import type { Session } from "next-auth"

export type UserRole = "patient" | "researcher"

declare module "next-auth" {
  interface User {
    role: UserRole
  }
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    id: string
  }
}

const DEMO_USERS = [
  { id: "patient-001", email: "patient@demo.com", password: "demo1234", role: "patient" as UserRole },
  { id: "researcher-001", email: "researcher@demo.com", password: "demo1234", role: "researcher" as UserRole },
]

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
        const user = DEMO_USERS.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        )
        if (!user) return null
        return { id: user.id, email: user.email, role: user.role, name: user.email }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as typeof DEMO_USERS[0]).role
        token.id = user.id
      }
      return token
    },
    session({ session, token }: { session: Session; token: JWT }) {
      session.user.role = token.role
      session.user.id = token.id
      return session
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour
  },
  secret: process.env.NEXTAUTH_SECRET,
}
