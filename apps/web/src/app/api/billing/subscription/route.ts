import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ subscription: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true }
    });

    if (!user?.subscription) {
      return NextResponse.json({ subscription: null }, { status: 200 });
    }

    return NextResponse.json({
      subscription: {
        planId: user.subscription.planId,
        status: user.subscription.status,
        currentPeriodEnd: user.subscription.currentPeriodEnd ? user.subscription.currentPeriodEnd.toISOString() : null,
      }
    });
  } catch (error: any) {
    console.error("Failed to fetch subscription status:", error);
    return NextResponse.json({ subscription: null }, { status: 500 });
  }
}
