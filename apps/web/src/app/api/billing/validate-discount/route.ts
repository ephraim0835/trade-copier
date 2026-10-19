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
    const { code, planId = "pro", currency = "USD" } = body;

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ valid: false, error: "Please enter a discount code." }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    const discount = await prisma.discountCode.findUnique({
      where: { code: cleanCode },
    });

    if (!discount || !discount.isActive) {
      return NextResponse.json({ valid: false, error: "Invalid or inactive discount code." }, { status: 404 });
    }

    if (discount.validUntil && new Date() > discount.validUntil) {
      return NextResponse.json({ valid: false, error: "This discount code has expired." }, { status: 400 });
    }

    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      return NextResponse.json({ valid: false, error: "This discount code has reached its maximum usage limit." }, { status: 400 });
    }

    // Calculate base amounts
    const isNgn = currency === "NGN";
    let basePrice = 0;
    if (planId === "basic") {
      basePrice = isNgn ? 39000 : 26;
    } else {
      // Default to pro
      basePrice = isNgn ? 58500 : 39;
    }

    const discountMultiplier = (100 - discount.percentage) / 100;
    const finalAmount = Math.max(1, Math.round(basePrice * discountMultiplier * 100) / 100);
    const savings = Math.round((basePrice - finalAmount) * 100) / 100;

    return NextResponse.json({
      valid: true,
      code: discount.code,
      percentage: discount.percentage,
      duration: discount.duration,
      originalAmount: basePrice,
      savings,
      finalAmount,
      currency: isNgn ? "NGN" : "USD",
    });
  } catch (error: any) {
    console.error("Discount validation error:", error);
    return NextResponse.json({ valid: false, error: error.message || "Failed to validate code." }, { status: 500 });
  }
}
