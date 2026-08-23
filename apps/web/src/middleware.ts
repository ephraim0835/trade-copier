import { withAuth } from "next-auth/middleware";

export default withAuth({
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
