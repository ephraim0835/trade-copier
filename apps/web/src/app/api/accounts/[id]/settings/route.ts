import { getServerSession } from "next-auth/next";
import { NextResponse, NextRequest } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";

/**
 * Authenticated proxy for account settings PATCH.
 * The client cannot send the JWT directly (CORS / security), so this
 * Next.js route handler attaches the server-side NextAuth JWT and
 * forwards the request to the NestJS API.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ error: "API URL not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();

    const response = await fetch(`${apiUrl}/accounts/${id}/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(session as any).accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying settings PATCH:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
