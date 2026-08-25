import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import argon2 from 'argon2';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, newPassword } = await req.json();

    if (!code || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const email = session.user.email;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.resetToken || !user.resetTokenExpiresAt) {
      return NextResponse.json({ error: 'No reset request found' }, { status: 400 });
    }

    if (new Date() > user.resetTokenExpiresAt) {
      return NextResponse.json({ error: 'Reset code expired. Please request a new one.' }, { status: 400 });
    }

    if (user.resetToken !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    const hashedPassword = await argon2.hash(newPassword);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
