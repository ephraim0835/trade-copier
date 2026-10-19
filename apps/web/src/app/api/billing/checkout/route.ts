import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, discountCode, currency = "USD" } = body;

    let amount = 0;
    let planName = "";
    const selectedCurrency = (currency === "NGN") ? "NGN" : "USD";

    if (planId === "basic") {
      amount = selectedCurrency === "NGN" ? 39000 : 26;
      planName = "Basic Plan";
    } else if (planId === "pro") {
      amount = selectedCurrency === "NGN" ? 58500 : 39;
      planName = "Pro Plan";
    } else {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    let appliedDiscount: any = null;
    if (discountCode) {
      const cleanCode = String(discountCode).trim().toUpperCase();
      const codeRecord = await prisma.discountCode.findUnique({
        where: { code: cleanCode }
      });

      if (!codeRecord || !codeRecord.isActive) {
        return NextResponse.json({ error: "Invalid or inactive discount code" }, { status: 400 });
      }

      if (codeRecord.validUntil && new Date() > codeRecord.validUntil) {
        return NextResponse.json({ error: "Discount code has expired" }, { status: 400 });
      }

      if (codeRecord.maxUses !== null && codeRecord.usedCount >= codeRecord.maxUses) {
        return NextResponse.json({ error: "Discount code usage limit reached" }, { status: 400 });
      }

      appliedDiscount = codeRecord;
      const discountMultiplier = (100 - codeRecord.percentage) / 100;
      amount = Math.max(1, Math.round(amount * discountMultiplier * 100) / 100);
    }

    // Lookup user in the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a unique transaction reference
    const tx_ref = `tx-${user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const flwSecret = process.env.FLW_SECRET_KEY;
    if (!flwSecret) {
      console.error("Missing FLW_SECRET_KEY in environment");
      return NextResponse.json({ 
        error: "Billing gateway is not yet configured. Please set FLW_SECRET_KEY in your environment settings." 
      }, { status: 500 });
    }

    // The base URL of the application
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || req.nextUrl.origin;
    const redirect_url = `${appUrl}/billing/verify?tx_ref=${tx_ref}&plan=${planId}`;

    const payload = {
      tx_ref,
      amount,
      currency: selectedCurrency,
      redirect_url,
      meta: {
        userId: user.id,
        planId: planId,
        currency: selectedCurrency
      },
      customer: {
        email: user.email,
        name: user.name || user.email.split('@')[0] || "Customer"
      },
      customizations: {
        title: "Plaiz Markets Subscription",
        description: `Payment for ${planName} (${selectedCurrency === 'NGN' ? '₦' : '$'}${amount.toLocaleString()})`
      }
    };

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flwSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status === "success" && data.data?.link) {
      // Save the intent in the database
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
          flutterwaveTxRef: tx_ref,
          planId: planId,
          ...(appliedDiscount ? { discountCodeId: appliedDiscount.id } : {})
        },
        create: {
          userId: user.id,
          flutterwaveTxRef: tx_ref,
          planId: planId,
          status: "TRIAL",
          ...(appliedDiscount ? { discountCodeId: appliedDiscount.id } : {})
        }
      });

      return NextResponse.json({ link: data.data.link });
    } else {
      console.error("Flutterwave API Error:", data);
      return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });
    }
  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
