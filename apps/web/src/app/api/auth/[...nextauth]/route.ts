import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // Call the NestJS API
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          if (process.env.NODE_ENV === 'production' && !apiUrl) {
            throw new Error('NEXT_PUBLIC_API_URL must be defined in production');
          }
          const finalApiUrl = apiUrl || 'http://localhost:9001/api/v1';

          const res = await fetch(`${finalApiUrl}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
              username: credentials.email, // passport-local defaults to 'username'
              password: credentials.password
            }),
            headers: { "Content-Type": "application/json" }
          });
          
          if (!res.ok) {
            return null;
          }
          
          const data = await res.json();
          // The API returns access_token
          if (data && data.access_token) {
            return {
              id: credentials.email,
              email: credentials.email,
              accessToken: data.access_token
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
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
