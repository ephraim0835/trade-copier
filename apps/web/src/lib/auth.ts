import CredentialsProvider from "next-auth/providers/credentials"
import type { NextAuthOptions } from "next-auth"

let API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://plaiz-markets-api.onrender.com';

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  return res.json(); // { access_token, refresh_token, access_token_expires_at }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
              username: credentials.email,
              password: credentials.password
            }),
            headers: { "Content-Type": "application/json" }
          });

          if (!res.ok) return null;

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
          return null;
        } catch (e) {
          console.error("Auth error:", e);
          return null;
        }
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
  secret: process.env.NEXTAUTH_SECRET,
};
