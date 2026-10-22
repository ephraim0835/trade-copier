import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.subscription || user.subscription.status === "CANCELED") {
      return NextResponse.json({ 
        error: "No active subscription found to cancel." 
      }, { status: 400 });
    }

    // 1. Attempt to deactivate recurring subscription on Flutterwave if configured
    try {
      const { getFlutterwaveConfig } = await import("@/lib/flutterwave");
      const { secretKey: flwSecret } = getFlutterwaveConfig();

      if (flwSecret && user.email) {
        const flwRes = await fetch(
          `https://api.flutterwave.com/v3/subscriptions?email=${encodeURIComponent(user.email)}`, 
          {
            headers: {
              Authorization: `Bearer ${flwSecret}`,
              "Content-Type": "application/json"
            }
          }
        );
        const flwData = await flwRes.json().catch(() => ({}));
        if (flwData.status === "success" && Array.isArray(flwData.data)) {
          for (const sub of flwData.data) {
            if (sub.id && sub.status === "active") {
              await fetch(`https://api.flutterwave.com/v3/subscriptions/${sub.id}/cancel`, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${flwSecret}`,
                  "Content-Type": "application/json"
                }
              }).catch((e) => console.error(`Failed to cancel FLW subscription ${sub.id}:`, e));
            }
          }
        }
      }
    } catch (flwErr) {
      console.error("Flutterwave API subscription cancellation check failed:", flwErr);
      // We still proceed with revoking benefits immediately in our system
    }

    // 2. Immediate revocation of benefits in the database:
    // a. Mark subscription as CANCELED with currentPeriodEnd set to now
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        status: "CANCELED",
        currentPeriodEnd: new Date()
      }
    });

    // b. Stop automated bot copying for this user immediately
    await prisma.user.update({
      where: { id: user.id },
      data: { botStopped: true }
    });

    // c. Deactivate all account copy subscription links immediately
    await prisma.accountSubscription.updateMany({
      where: {
        OR: [
          { masterAccount: { userId: user.id } },
          { subAccount: { userId: user.id } }
        ]
      },
      data: { isActive: false }
    });

    // d. Create alert notification for user
    await prisma.userNotification.create({
      data: {
        userId: user.id,
        title: "Subscription Cancelled",
        message: "Your subscription has been cancelled. Automated trade copying and slave account executions have been stopped immediately.",
        type: "ALERT",
        actionUrl: "/pricing"
      }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Subscription successfully cancelled and copier benefits deactivated immediately."
    });
  } catch (error: any) {
    console.error("Cancellation error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to cancel subscription" 
    }, { status: 500 });
  }
}
