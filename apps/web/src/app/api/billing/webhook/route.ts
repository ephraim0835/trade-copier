import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const secretHash = process.env.FLW_WEBHOOK_HASH;
    const signature = req.headers.get("verif-hash");

    if (secretHash && signature !== secretHash) {
      // If a webhook hash is configured, require it
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = await req.json();

    // According to Flutterwave docs, successful payments come with event: 'charge.completed'
    if (payload.event === "charge.completed" && payload.data?.status === "successful") {
      const { tx_ref, customer, amount } = payload.data;
      
      const user = await prisma.user.findUnique({
        where: { email: customer.email }
      });

      if (user) {
        // Look for the user's subscription or create it if missing
        const planId = amount >= 39 ? "pro" : "basic";
        
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
