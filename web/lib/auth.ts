import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"
import type { Session } from "next-auth"

export type UserRole = "patient" | "researcher"

declare module "next-auth" {
  interface User {
    role: UserRole
    displayName?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
      displayName?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    id: string
    displayName?: string
  }
}

// In-memory user registry — survives hot reloads in dev
const g = globalThis as unknown as {
  _markovUsers?: Map<string, { id: string; email: string; password: string; role: UserRole; displayName: string; phone?: string; address?: string }>
}
g._markovUsers ??= new Map()

// Seed demo accounts
if (!g._markovUsers.has("patient@demo.com")) {
  g._markovUsers.set("patient@demo.com", {
    id: "patient-001",
    email: "patient@demo.com",
    password: "demo1234",
    role: "patient",
    displayName: "Sarah Jenkins",
    phone: "(607) 555-0142",
    address: "312 Elm Street, Ithaca, NY 14850",
  })
}
if (!g._markovUsers.has("researcher@demo.com")) {
  g._markovUsers.set("researcher@demo.com", {
    id: "researcher-001",
    email: "researcher@demo.com",
    password: "demo1234",
    role: "researcher",
    displayName: "Dr. Alistair Vance",
    phone: "(212) 639-5710",
  })
}

export function registerUser(opts: {
  email: string
  password: string
  role: UserRole
  displayName: string
  phone?: string
  address?: string
}): { success: boolean; error?: string } {
  if (g._markovUsers!.has(opts.email)) {
    return { success: false, error: "An account with that email already exists." }
  }
  const id = `${opts.role}-${Date.now()}`
  g._markovUsers!.set(opts.email, { ...opts, id })
  return { success: true }
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
        const user = g._markovUsers!.get(credentials.email)
        if (!user || user.password !== credentials.password) return null
        return { id: user.id, email: user.email, role: user.role, name: user.displayName, displayName: user.displayName }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: UserRole }).role
        token.id = user.id
        token.displayName = (user as { displayName?: string }).displayName
      }
      return token
    },
    session({ session, token }: { session: Session; token: JWT }) {
      session.user.role = token.role
      session.user.id = token.id
      session.user.displayName = token.displayName
      return session
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
}
