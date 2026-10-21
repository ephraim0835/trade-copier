import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions) || await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://plaiz-markets-api.onrender.com';
  const internalSecret = process.env.INTERNAL_MANAGER_SECRET;

  // 1. Try with user's access token if available
  const accessToken = (session as any)?.accessToken;
  if (accessToken) {
    try {
      const response = await fetch(`${apiUrl}/realtime/ticket`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      console.warn("Realtime ticket JWT request failed, trying internal ticket endpoint:", e);
    }
  }

  // 2. Fallback: Request ticket via internal endpoint using the authenticated user ID from DB
  if (!internalSecret) {
    console.error("INTERNAL_MANAGER_SECRET is not configured on web server");
    return NextResponse.json({ error: "Realtime service configuration missing" }, { status: 500 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const response = await fetch(`${apiUrl}/realtime/internal/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({ userId: user.id }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Failed to generate ticket via internal endpoint:", response.status, errText);
      return NextResponse.json({ error: "Failed to generate ticket" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating realtime ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

