import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const secretHash = process.env.FLW_WEBHOOK_HASH;
    const signature = req.headers.get("verif-hash");

    if (process.env.NODE_ENV === 'production' && !secretHash) {
      console.error("FLW_WEBHOOK_HASH must be configured in production");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    if (secretHash) {
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      const hashBuf = Buffer.from(secretHash);
      const sigBuf = Buffer.from(signature);
      if (hashBuf.length !== sigBuf.length || !crypto.timingSafeEqual(hashBuf, sigBuf)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = await req.json();

    // According to Flutterwave docs, successful payments come with event: 'charge.completed'
    if (payload.event === "charge.completed" && payload.data?.status === "successful") {
      const { tx_ref, customer, amount, currency } = payload.data;
      
      const user = await prisma.user.findUnique({
        where: { email: customer.email }
      });

      if (user) {
        // Look for the user's subscription or create it if missing
        const metaPlan = payload.data?.meta?.planId;
        const isNgn = (currency || "").toUpperCase() === "NGN";
        const planId = metaPlan || (amount >= (isNgn ? 50000 : 35) ? "pro" : "basic");
        
        // Let's define the current period end as 1 month from now
        const currentPeriodEnd = new Date();
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            status: "ACTIVE",
            flutterwaveCustomerId: customer.id ? customer.id.toString() : null,
            flutterwaveTxRef: tx_ref,
            currentPeriodEnd,
            planId
          },
          create: {
            userId: user.id,
            status: "ACTIVE",
            flutterwaveCustomerId: customer.id ? customer.id.toString() : null,
            flutterwaveTxRef: tx_ref,
            currentPeriodEnd,
            planId
          }
        });

        console.log(`Successfully activated subscription for user ${user.id} via Flutterwave`);
      }
    }

    // Always return a 200 OK so Flutterwave doesn't retry infinitely
    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Flutterwave Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
