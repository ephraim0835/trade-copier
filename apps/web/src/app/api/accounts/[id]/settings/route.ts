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

  // Use server-side env var (API_URL) with fallback to the public one, then hardcoded Render URL
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://plaiz-markets-api.onrender.com';

  try {
    const body = await request.json();
    
    // BACKWARD COMPATIBILITY HACK:
    // If the Render API is still running old code, it expects 'riskMultiplier'.
    // If it's running new code, it expects 'riskPercentage'.
    // We send both to guarantee it saves regardless of the backend deploy status!
    if (body.riskPercentage !== undefined) {
      body.riskMultiplier = body.riskPercentage;
    }

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
