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
    const { planId } = body;

    let amount = 0;
    let planName = "";

    if (planId === "basic") {
      amount = 26;
      planName = "Basic Plan";
    } else if (planId === "pro") {
      amount = 39;
      planName = "Pro Plan";
    } else {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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
      return NextResponse.json({ error: "Billing is not configured" }, { status: 500 });
    }

    // The base URL of the application
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || req.nextUrl.origin;

    const payload = {
      tx_ref,
      amount,
      currency: "USD",
      redirect_url: `${appUrl}/dashboard?payment=success`,
      meta: {
        userId: user.id,
        planId: planId
      },
      customer: {
        email: user.email,
        name: user.name || "Customer"
      },
      customizations: {
        title: "Plaiz Markets Subscription",
        description: `Payment for ${planName}`
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
        },
        create: {
          userId: user.id,
          flutterwaveTxRef: tx_ref,
          planId: planId,
          status: "TRIAL"
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
