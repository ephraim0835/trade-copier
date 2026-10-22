import { Metadata } from 'next';
import { PricingClient } from './pricing-client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Pricing Plans | Plaiz Markets',
  description: 'Choose your automated trade copier plan. Transparent pricing with instant Flutterwave activation and ultra-low latency execution.',
};

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  let userSubscription: { planId: string | null; status: string } | null = null;

  if (session?.user?.email) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { subscription: true },
      });
      if (user?.subscription) {
        userSubscription = {
          planId: user.subscription.planId,
          status: user.subscription.status,
        };
      }
    } catch (e) {
      console.error('Failed to load user subscription on pricing page:', e);
    }
  }

  return <PricingClient userSubscription={userSubscription} />;
}
