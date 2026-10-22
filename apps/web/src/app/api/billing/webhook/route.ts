import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendSubscriptionReceiptEmail, sendAdminSubscriptionAlert } from "@/lib/email";

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
        let planId = metaPlan;
        if (!planId) {
          if (amount >= (isNgn ? 100000 : 70)) {
            planId = "elite";
          } else if (amount >= (isNgn ? 50000 : 35)) {
            planId = "pro";
          } else {
            planId = "starter";
          }
        }
        
        // Let's define the current period end as 1 month from now
        const currentPeriodEnd = new Date();
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

        const sub = await prisma.subscription.upsert({
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

        if (sub.discountCodeId) {
          await prisma.discountCode.update({
            where: { id: sub.discountCodeId },
            data: { usedCount: { increment: 1 } },
          }).catch((e) => console.error("Could not increment discount usedCount:", e));
        }

        // Official Dispute Reference ID
        const referenceId = `PLZ-REF-${tx_ref}`;
        const flwTxId = payload.data?.id ? String(payload.data.id) : null;
        const flwCustId = customer.id ? String(customer.id) : null;
        const chargedCurrency = (currency || "USD").toUpperCase();

        // 1. In-app receipt and dispute reference for the user
        await prisma.userNotification.create({
          data: {
            userId: user.id,
            title: "Subscription Confirmed — Dispute Reference ID",
            message: `Thank you for subscribing to Plaiz Markets! Your official dispute reference ID is ${referenceId}. Keep this ID safe in case of any billing dispute or inquiry.`,
            type: "SUCCESS",
            actionUrl: "/billing",
          },
        }).catch((e) => console.error("Could not create user notification:", e));

        // 2. Official dispute log for Admin / Owner
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "OWNER"] } },
          select: { id: true, email: true, name: true }
        });

        for (const admin of admins) {
          await prisma.userNotification.create({
            data: {
              userId: admin.id,
              title: `[Dispute Log] New Subscription — ${referenceId}`,
              message: `Subscriber: ${user.email} (${user.name || 'N/A'})\nPlan: ${planId.toUpperCase()}\nAmount: ${chargedCurrency} ${amount}\nRef ID: ${referenceId}\nFLW TxRef: ${tx_ref}\nFLW TxID: ${flwTxId || 'N/A'}`,
              type: "INFO",
              actionUrl: "/admin",
            },
          }).catch((e) => console.error("Could not create admin notification:", e));

          // Send admin alert email
          sendAdminSubscriptionAlert({
            adminEmail: admin.email,
            userEmail: user.email,
            userName: user.name,
            planName: planId,
            amount: amount,
            currency: chargedCurrency,
            referenceId,
            flwTxRef: tx_ref,
            flwTransactionId: flwTxId,
            flwCustomerId: flwCustId,
          }).catch((e) => console.error("Could not send admin alert email:", e));
        }

        // 3. Send Thank You receipt email to user
        sendSubscriptionReceiptEmail({
          email: user.email,
          name: user.name,
          planName: planId,
          amount: amount,
          currency: chargedCurrency,
          referenceId,
          periodEnd: currentPeriodEnd,
        }).catch((e) => console.error("Could not send user receipt email:", e));

        console.log(`Successfully activated subscription for user ${user.id} via Flutterwave (Ref: ${referenceId})`);
      }
    }

    // Always return a 200 OK so Flutterwave doesn't retry infinitely
    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Flutterwave Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
