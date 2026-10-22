import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetCode } from '@/lib/email';
import crypto from 'crypto';

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.user.email;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a secure 6-digit code using CSPRNG
    // Generate a secure 6-digit code using CSPRNG
    const code = crypto.randomInt(100000, 1000000).toString();
    
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Namespace with code_ prefix so public link token reset can NEVER match in-app codes (SEC-015)
    await prisma.user.update({
      where: { email },
      data: {
        resetToken: `code_${code}`,
        resetTokenExpiresAt: expiresAt
      }
    });

    await sendPasswordResetCode(email, user.name || '', code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
