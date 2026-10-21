import { getServerSession } from "next-auth/next";
import { NextResponse, NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized. Please log in again." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const account = await prisma.mt5Account.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ message: "Account not found." }, { status: 404 });
    }

    if (account.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'OWNER') {
      return NextResponse.json({ message: "You do not have permission to modify this account." }, { status: 403 });
    }

    const body = await request.json();
    const {
      displayName,
      riskPercentage,
      roundingTolerancePct,
      dailyRiskEnabled,
      maxDailyRisk,
      maxTradesEnabled,
      maxActiveTrades,
      requireTp,
      missingSlTimeoutSec,
      maxRecoveryRRDegradation,
    } = body;

    if (displayName !== undefined) {
      await prisma.mt5Account.update({
        where: { id },
        data: { displayName: displayName ? String(displayName).trim() : null },
      });
    }

    const copySettingsData: any = {};
    if (riskPercentage !== undefined) {
      const num = Number(riskPercentage);
      if (isNaN(num) || num < 0.01 || num > 100) {
        return NextResponse.json({ message: "Risk percentage must be between 0.01% and 100%." }, { status: 400 });
      }
      copySettingsData.riskPercentage = num;
    }
    if (roundingTolerancePct !== undefined) {
      const num = Number(roundingTolerancePct);
      if (!isNaN(num)) copySettingsData.roundingTolerancePct = Math.max(0, Math.min(100, num));
    }
    if (dailyRiskEnabled !== undefined) copySettingsData.dailyRiskEnabled = Boolean(dailyRiskEnabled);
    if (maxDailyRisk !== undefined) {
      const num = Number(maxDailyRisk);
      if (!isNaN(num)) copySettingsData.maxDailyRisk = Math.max(0, Math.min(100, num));
    }
    if (maxTradesEnabled !== undefined) copySettingsData.maxTradesEnabled = Boolean(maxTradesEnabled);
    if (maxActiveTrades !== undefined) {
      const num = parseInt(String(maxActiveTrades), 10);
      if (!isNaN(num)) copySettingsData.maxActiveTrades = Math.max(1, Math.min(500, num));
    }
    if (requireTp !== undefined) copySettingsData.requireTp = Boolean(requireTp);
    if (missingSlTimeoutSec !== undefined) {
      const num = parseInt(String(missingSlTimeoutSec), 10);
      if (!isNaN(num)) copySettingsData.missingSlTimeoutSec = Math.max(0, Math.min(3600, num));
    }
    if (maxRecoveryRRDegradation !== undefined) {
      const num = Number(maxRecoveryRRDegradation);
      if (!isNaN(num)) copySettingsData.maxRecoveryRRDegradation = Math.max(0, Math.min(100, num));
    }

    const updatedSettings = await prisma.copySettings.upsert({
      where: { mt5AccountId: id },
      update: copySettingsData,
      create: {
        mt5AccountId: id,
        ...copySettingsData,
      },
    });

    return NextResponse.json(updatedSettings);
  } catch (error: any) {
    console.error("Error updating account settings:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
