import { NextResponse } from 'next/server';
import { fetchLiveRates } from '@/lib/currency';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  try {
    const rates = await fetchLiveRates();
    return NextResponse.json({
      success: true,
      base: 'USD',
      rates,
      timestamp: Date.now()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
