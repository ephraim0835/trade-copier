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

    const body = await req.json();
    const { transaction_id, tx_ref } = body;

    if (!transaction_id && !tx_ref) {
      return NextResponse.json({ error: "Transaction ID or reference required" }, { status: 400 });
    }

    const flwSecret = process.env.FLW_SECRET_KEY;
    if (!flwSecret) {
      return NextResponse.json({ error: "Billing gateway not configured" }, { status: 500 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify transaction with Flutterwave API
    let verifiedData: any = null;
    if (transaction_id) {
      const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        }
      });
      const resJson = await flwRes.json().catch(() => ({}));
      if (resJson.status === "success" && resJson.data?.status === "successful") {
        verifiedData = resJson.data;
      }
    }

    if (!verifiedData && tx_ref) {
      // Fallback verification by tx_ref
      const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`, {
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          "Content-Type": "application/json"
        }
      });
      const resJson = await flwRes.json().catch(() => ({}));
      if (resJson.status === "success" && resJson.data?.status === "successful") {
        verifiedData = resJson.data;
      }
    }

    if (!verifiedData) {
      return NextResponse.json({ 
        success: false, 
        error: "Unable to verify payment with payment provider or payment was not successful." 
      }, { status: 400 });
    }

    // Determine plan
    const metaPlan = verifiedData.meta?.planId || user.subscription?.planId || "starter";
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        status: "ACTIVE",
        planId: metaPlan,
        flutterwaveTxRef: verifiedData.tx_ref || tx_ref,
        flutterwaveCustomerId: verifiedData.customer?.id ? String(verifiedData.customer.id) : null,
        currentPeriodEnd
      },
      create: {
        userId: user.id,
        status: "ACTIVE",
        planId: metaPlan,
        flutterwaveTxRef: verifiedData.tx_ref || tx_ref,
        flutterwaveCustomerId: verifiedData.customer?.id ? String(verifiedData.customer.id) : null,
        currentPeriodEnd
      }
    });

    if (subscription.discountCodeId) {
      await prisma.discountCode.update({
        where: { id: subscription.discountCodeId },
        data: { usedCount: { increment: 1 } },
      }).catch((e) => console.error("Could not increment discount usedCount:", e));
    }

    return NextResponse.json({
      success: true,
      subscription: {
        status: subscription.status,
        planId: subscription.planId,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });
  } catch (err: any) {
    console.error("Verification error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
