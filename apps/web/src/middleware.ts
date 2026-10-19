import { withAuth } from "next-auth/middleware";

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET || 'trade_copier_secure_nextauth_secret_2026',
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/accounts/:path*",
    "/positions/:path*",
    "/risk/:path*",
    "/performance/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/admin/:path*"
  ]
};
