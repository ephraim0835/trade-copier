import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const results = [];
    
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "CopySettings" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
      results.push('Renamed CopySettings');
    } catch (e: any) { results.push(e.message); }

    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "CopySettings" ALTER COLUMN "riskPercentage" SET DEFAULT 1.0');
      results.push('Set Default');
    } catch (e: any) { results.push(e.message); }

    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "AccountSubscription" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
      results.push('Renamed AccountSubscription');
    } catch (e: any) { results.push(e.message); }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
