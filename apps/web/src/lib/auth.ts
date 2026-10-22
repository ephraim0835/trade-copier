import CredentialsProvider from "next-auth/providers/credentials"
import type { NextAuthOptions } from "next-auth"

const RAW_API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://plaiz-markets-api.onrender.com';
const API_URL = RAW_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');

async function refreshAccessToken(refreshToken: string) {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        oneTimeToken: { label: "OneTimeToken", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        // Auto-login via one-time verification token
        if (credentials.oneTimeToken) {
          try {
            const { prisma } = await import('@/lib/prisma');
            const cleanEmail = credentials.email.toLowerCase().trim();
            const user = await prisma.user.findUnique({
              where: { email: cleanEmail },
            });
            if (
              user &&
              user.resetToken &&
              user.resetToken === credentials.oneTimeToken &&
              user.resetTokenExpiresAt &&
              user.resetTokenExpiresAt > new Date()
            ) {
              await prisma.user.update({
                where: { id: user.id },
                data: { resetToken: null, resetTokenExpiresAt: null },
              });
              return {
                id: user.id,
                email: user.email,
                name: user.name,
              };
            }
          } catch (e) {
            console.error("One-time token auth error:", e);
          }
        }

        if (!credentials.password) return null;

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
              username: credentials.email,
              password: credentials.password
            }),
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(4000),
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.access_token) {
              return {
                id: credentials.email,
                email: credentials.email,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                accessTokenExpiresAt: data.access_token_expires_at,
              };
            }
          }
        } catch (e) {
          console.error("Auth API error, checking local database:", e);
        }

        // Direct DB fallback if NestJS API is unreachable
        try {
          const { prisma } = await import('@/lib/prisma');
          const argon2 = await import('argon2');
          const cleanEmail = credentials.email.toLowerCase().trim();
          const user = await prisma.user.findUnique({
            where: { email: cleanEmail },
          });
          if (user && user.password && (await argon2.verify(user.password, credentials.password))) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
            };
          }
        } catch (dbErr) {
          console.error("Direct DB auth fallback error:", dbErr);
        }

        return null;
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.accessTokenExpiresAt = (user as any).accessTokenExpiresAt;
        return token;
      }

      const expiresAt = token.accessTokenExpiresAt as number;
      const twoMinutesMs = 2 * 60 * 1000;
      if (expiresAt && Date.now() < expiresAt - twoMinutesMs) {
        return token; 
      }

      if (!token.refreshToken) return token;

      try {
        const refreshed = await refreshAccessToken(token.refreshToken as string);
        if (refreshed) {
          token.accessToken = refreshed.access_token;
          token.refreshToken = refreshed.refresh_token;
          token.accessTokenExpiresAt = refreshed.access_token_expires_at;
        } else {
          token.error = 'RefreshTokenExpired';
        }
      } catch {
        token.error = 'RefreshTokenExpired';
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).error = token.error;
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_ACCESS_SECRET || 'trade_copier_secure_nextauth_secret_2026',
};
