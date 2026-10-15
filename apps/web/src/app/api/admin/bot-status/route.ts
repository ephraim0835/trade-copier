import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions) || await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const vps = await prisma.vpsEnvironment.findFirst({
      orderBy: { lastHeartbeatAt: 'desc' },
    });

    if (!vps || !vps.lastHeartbeatAt) {
      return NextResponse.json({
        isOnline: false,
        vps: null,
        message: "No VPS environment telemetry found",
      });
    }

    const diffSeconds = Math.round((Date.now() - new Date(vps.lastHeartbeatAt).getTime()) / 1000);
    // The VPS manager sends heartbeat every 30 seconds. Consider active if within 90 seconds.
    const isOnline = diffSeconds < 90;

    return NextResponse.json({
      isOnline,
      vps: {
        id: vps.id,
        name: vps.name,
        status: vps.status,
        cpuPercent: vps.cpuPercent,
        ramPercent: vps.ramPercent,
        diskPercent: vps.diskPercent,
        activeTerminals: vps.activeTerminals,
        lastHeartbeatAt: vps.lastHeartbeatAt,
        secondsAgo: Math.max(0, diffSeconds),
      },
    });
  } catch (error) {
    console.error("Failed to query bot status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
