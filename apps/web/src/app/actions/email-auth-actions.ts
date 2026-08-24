'use server';

import { prisma } from '@/lib/prisma';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';

export async function registerUser(email: string, passwordPlain: string, name: string) {
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return { error: 'Email already exists' };

    const passwordHash = await argon2.hash(passwordPlain);

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name,
        role: 'USER',
      },
    });
    
    return { success: true, user: { id: user.id, email: user.email } };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'Failed to create account' };
  }
}

// Send / resend verification email
export async function sendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: 'User not found' };
  if (user.emailVerified) return { error: 'Email already verified' };

  const token = randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { email },
    data: { verificationToken: token },
  });

  await sendVerificationEmail(email, user.name || '', token);
  return { success: true };
}

// Confirm verification token
export async function confirmVerification(token: string) {
  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });
  if (!user) return { error: 'Invalid or expired verification link.' };

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null },
  });
  return { success: true };
}

// Send password reset email
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success to prevent email enumeration
  if (!user) return { success: true };

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { email },
    data: { resetToken: token, resetTokenExpiresAt: expiresAt },
  });

  await sendPasswordResetEmail(email, user.name || '', token);
  return { success: true };
}

// Reset password with token
export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: { resetToken: token },
  });

  if (!user) return { error: 'Invalid or expired reset link.' };
  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return { error: 'This reset link has expired. Please request a new one.' };
  }

  const hashedPassword = await argon2.hash(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });
  return { success: true };
}
