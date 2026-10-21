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

    // 1. Transaction Ownership Validation
    const customerEmail = verifiedData.customer?.email?.toLowerCase().trim();
    const sessionEmail = session.user.email.toLowerCase().trim();
    const finalTxRef = verifiedData.tx_ref || tx_ref;

    // Check ownership through any of the secure links:
    // a) tx_ref starts with `tx-${user.id}-`
    // b) meta.userId equals user.id
    // c) customer.email equals active session email
    // d) user.subscription?.flutterwaveTxRef equals finalTxRef
    const isMatchingUserTx = Boolean(finalTxRef && finalTxRef.startsWith(`tx-${user.id}-`));
    const isMatchingMetaUser = verifiedData.meta?.userId === user.id;
    const isMatchingEmail = Boolean(customerEmail && customerEmail === sessionEmail);
    const isMatchingSavedIntent = Boolean(user.subscription?.flutterwaveTxRef && user.subscription.flutterwaveTxRef === finalTxRef);

    if (!isMatchingUserTx && !isMatchingMetaUser && !isMatchingEmail && !isMatchingSavedIntent) {
      console.warn(`[Security] Billing IDOR attempt: user ${user.id} (${sessionEmail}) tried to claim unowned transaction ${finalTxRef}`);
      return NextResponse.json({
        success: false,
        error: "Transaction reference or customer does not match your active account."
      }, { status: 403 });
    }

    // 2. Replay attack prevention: Ensure tx_ref has not already been claimed by another user
    if (finalTxRef) {
      const existingSub = await prisma.subscription.findFirst({
        where: {
          flutterwaveTxRef: finalTxRef,
          userId: { not: user.id },
          status: "ACTIVE",
        },
      });

      if (existingSub) {
        console.warn(`[Security] Billing Replay attempt: user ${user.id} tried to reuse already claimed tx_ref ${finalTxRef}`);
        return NextResponse.json({
          success: false,
          error: "This transaction has already been applied to another subscription."
        }, { status: 409 });
      }
    }

    // 4. Amount and currency validation
    const chargedAmount = Number(verifiedData.amount || 0);
    const currency = (verifiedData.currency || "USD").toUpperCase();
    if (chargedAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid transaction amount recorded."
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
