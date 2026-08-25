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
    
    // User 1: Highest paid plan features forever
    const email1 = 'ofoliephraim@gmail.com';
    const user1 = await prisma.user.findUnique({ where: { email: email1 } });
    if (user1) {
      await prisma.subscription.upsert({
        where: { userId: user1.id },
        update: { status: 'INTERNAL_FREE', planId: 'pro' },
        create: { userId: user1.id, status: 'INTERNAL_FREE', planId: 'pro' }
      });
      results[email1] = 'Granted INTERNAL_FREE (Highest Plan)';
    } else {
      results[email1] = 'Not Found';
    }

    // User 2: Admin Dashboard Access
    const email2 = 'ofoli.ephraim2008@gmail.com';
    const user2 = await prisma.user.findUnique({ where: { email: email2 } });
    if (user2) {
      await prisma.user.update({
        where: { id: user2.id },
        data: { role: 'ADMIN' }
      });
      results[email2] = 'Granted ADMIN Role';
    } else {
      results[email2] = 'Not Found';
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
