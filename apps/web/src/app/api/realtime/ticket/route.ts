import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      if (process.env.NODE_ENV === 'development') {
        apiUrl = 'http://127.0.0.1:3001';
      } else {
        throw new Error("API_URL or NEXT_PUBLIC_API_URL must be configured in production.");
      }
    }
    const response = await fetch(`${apiUrl}/realtime/ticket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${(session as any).accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to generate ticket" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating realtime ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
