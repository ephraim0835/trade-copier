import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('secret') !== 'plaiz2026') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const results: any = {};
    
    // User 1: Make OWNER
    const email1 = 'ofoliephraim@gmail.com';
    const user1 = await prisma.user.findUnique({ where: { email: email1 } });
    if (user1) {
      await prisma.user.update({
        where: { id: user1.id },
        data: { role: 'OWNER' }
      });
      results[email1] = 'Granted OWNER Role';
    } else {
      results[email1] = 'Not Found';
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
