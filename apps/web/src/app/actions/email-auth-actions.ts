'use server';

import { prisma } from '@/lib/prisma';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import * as argon2 from 'argon2';
import { addBusinessDays } from '@/lib/trial-grace';

const SIGNUP_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_ACCESS_SECRET || 'trade_copier_secure_signup_secret_key_2026';
const KEY = createHash('sha256').update(SIGNUP_SECRET).digest();

interface PendingSignupData {
  email: string;
  name?: string;
  passwordHash: string;
  exp: number;
}

export async function encryptPendingSignup(data: PendingSignupData): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const jsonStr = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, encrypted]);
  return packed.toString('base64url');
}

export async function decryptPendingSignup(token: string): Promise<PendingSignupData | null> {
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    return null;
  }
}

/**
 * Initiates user registration without storing anything in the database until email verification.
 */
export async function registerUser(email: string, passwordPlain: string, name: string) {
  try {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { error: 'Please enter a valid email address.' };
    }

    if (!passwordPlain || passwordPlain.length < 8) {
      return { error: 'Password must be at least 8 characters long.' };
    }

    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      if (existingUser.emailVerified) {
        return { error: 'An account with this email already exists. Please sign in.' };
      }
      // If an existing legacy unverified record exists, clean it up so we start fresh
      await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => {});
    }

    const passwordHash = await argon2.hash(passwordPlain);
    const exp = Date.now() + 15 * 60 * 1000; // 15-minute validity window

    // Encrypt registration payload into self-contained cryptographically signed token
    // ZERO database records are created here! The email is NOT in the database!
    const pendingToken = await encryptPendingSignup({
      email: cleanEmail,
      name: name?.trim() || undefined,
      passwordHash,
      exp,
    });

    // Send the verification link containing the signed token
    await sendVerificationEmail(cleanEmail, name?.trim() || '', pendingToken, exp);

    return { 
      success: true, 
      pendingToken, 
      email: cleanEmail, 
      expiresAt: exp 
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'Failed to process registration. Please try again.' };
  }
}

/**
 * Resends verification email for a pending registration or existing unverified user.
 */
export async function sendVerification(tokenOrEmail: string) {
  try {
    // 1. Check if tokenOrEmail is a pending encrypted token
    const pending = await decryptPendingSignup(tokenOrEmail);
    if (pending) {
      const newExp = Date.now() + 15 * 60 * 1000;
      const freshToken = await encryptPendingSignup({
        ...pending,
        exp: newExp,
      });

      await sendVerificationEmail(pending.email, pending.name || '', freshToken, newExp);
      return { success: true, pendingToken: freshToken, expiresAt: newExp };
    }

    // 2. Check if it's an email string
    const cleanEmail = tokenOrEmail.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      // Return success to avoid email enumeration
      return { success: true, expiresAt: Date.now() + 15 * 60 * 1000 };
    }

    if (user.emailVerified) {
      return { error: 'Email already verified. Please sign in.' };
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    const storedToken = `${rawToken}.${expiresAtMs}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: storedToken },
    });

    await sendVerificationEmail(cleanEmail, user.name || '', rawToken, expiresAtMs);
    return { success: true, expiresAt: expiresAtMs };
  } catch (err: any) {
    console.error('Resend verification error:', err);
    return { error: 'Failed to resend verification link.' };
  }
}

/**
 * Confirms email verification.
 * Only at this step is the user account actually committed and saved to the database.
 */
export async function confirmVerification(token: string) {
  if (!token) return { error: 'No verification token provided.' };

  try {
    // A. Check modern encrypted pending signup token
    const pending = await decryptPendingSignup(token);
    if (pending) {
      if (Date.now() > pending.exp) {
        return { 
          error: 'This verification link has expired (links are valid for 15 minutes). Please sign up again or request a fresh link.',
          isExpired: true,
        };
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: pending.email },
      });

      if (existingUser) {
        // Account was ALREADY created (e.g. from mail prefetch or double-click)!
        // DO NOT show error! Return success and generate a 60-second one-time login token
        const oneTimeCode = `otl_${randomBytes(24).toString('hex')}`;
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: true,
            verificationToken: null,
            resetToken: oneTimeCode,
            resetTokenExpiresAt: new Date(Date.now() + 60 * 1000),
          },
        });

        return { 
          success: true, 
          email: existingUser.email, 
          oneTimeToken: oneTimeCode,
          alreadyVerified: true 
        };
      }

      // NOW CREATE THE USER IN THE DATABASE! ONLY UPON VERIFIED EMAIL!
      const trialEndsAt = addBusinessDays(new Date(), 5);
      const oneTimeCode = `otl_${randomBytes(24).toString('hex')}`;

      const newUser = await prisma.user.create({
        data: {
          email: pending.email,
          name: pending.name || null,
          password: pending.passwordHash,
          emailVerified: true,
          role: 'USER',
          resetToken: oneTimeCode,
          resetTokenExpiresAt: new Date(Date.now() + 60 * 1000), // 60s auto-login window
          subscription: {
            create: {
              status: 'TRIAL',
              planId: 'trial',
              currentPeriodEnd: trialEndsAt,
            },
          },
        },
      });

      return { 
        success: true, 
        email: newUser.email, 
        oneTimeToken: oneTimeCode 
      };
    }

    // B. Legacy database token fallback
    const rawToken = token.includes('.') ? token.split('.')[0] : token;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { verificationToken: token },
          { verificationToken: { startsWith: `${rawToken}.` } },
        ],
      },
    });

    if (user) {
      if (user.verificationToken?.includes('.')) {
        const parts = user.verificationToken.split('.');
        const expiresAt = parseInt(parts[1], 10);
        if (!isNaN(expiresAt) && Date.now() > expiresAt) {
          return { 
            error: 'This verification link has expired (links are valid for 15 minutes). Please request a new verification email.',
            isExpired: true,
          };
        }
      }

      const oneTimeCode = `otl_${randomBytes(24).toString('hex')}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          emailVerified: true, 
          verificationToken: null,
          resetToken: oneTimeCode,
          resetTokenExpiresAt: new Date(Date.now() + 60 * 1000),
        },
      });

      return { success: true, email: user.email, oneTimeToken: oneTimeCode };
    }

    return { error: 'Invalid or already used verification link.' };
  } catch (err: any) {
    console.error('Confirmation error:', err);
    return { error: 'An error occurred during verification.' };
  }
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
