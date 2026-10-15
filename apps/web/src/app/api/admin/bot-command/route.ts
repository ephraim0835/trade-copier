import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) || (await getServerSession());
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
    const body = await req.json();
    const command = (body.command || 'START').toUpperCase();

    if (!['START', 'RESTART', 'STOP', 'SYNC'].includes(command)) {
      return NextResponse.json({ error: "Invalid command. Supported: START, RESTART, STOP, SYNC" }, { status: 400 });
    }

    // Find the latest VPS environment record
    let vps = await prisma.vpsEnvironment.findFirst({
      orderBy: { lastHeartbeatAt: 'desc' },
    });

    if (!vps) {
      // Create an initial record if none exists yet
      vps = await prisma.vpsEnvironment.create({
        data: {
          name: 'vps-main-1',
          status: 'PENDING',
          lastCommand: command,
          commandAt: new Date(),
          commandStatus: 'PENDING',
          commandMessage: `Command ${command} queued by ${session.user.email}`,
        },
      });
    } else {
      vps = await prisma.vpsEnvironment.update({
        where: { id: vps.id },
        data: {
          lastCommand: command,
          commandAt: new Date(),
          commandStatus: 'PENDING',
          commandMessage: `Command ${command} queued by ${session.user.email}`,
        },
      });
    }

    // If starting or restarting, reset any failed accounts to PENDING so they can be re-evaluated
    if (command === 'START' || command === 'RESTART' || command === 'SYNC') {
      await prisma.mt5Account.updateMany({
        where: {
          isActive: true,
          connectionStatus: 'FAILED',
        },
        data: {
          connectionStatus: 'PENDING',
          provisioningError: null,
        },
      });
    }

    const diffSeconds = vps.lastHeartbeatAt
      ? Math.round((Date.now() - new Date(vps.lastHeartbeatAt).getTime()) / 1000)
      : 9999;
    const isOnline = diffSeconds < 90;

    return NextResponse.json({
      success: true,
      command,
      isOnline,
      vps: {
        id: vps.id,
        name: vps.name,
        lastHeartbeatAt: vps.lastHeartbeatAt,
        secondsAgo: diffSeconds,
        commandStatus: vps.commandStatus,
        commandMessage: vps.commandMessage,
      },
      message: isOnline
        ? `Command '${command}' transmitted to running host engine!`
        : `Command '${command}' queued. The host engine will execute as soon as the bot daemon starts.`,
    });
  } catch (error) {
    console.error("Failed to process bot command:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
