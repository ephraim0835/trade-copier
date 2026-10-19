import { Metadata } from 'next';
import { PricingClient } from './pricing-client';

export const metadata: Metadata = {
  title: 'Pricing Plans | Plaiz Markets',
  description: 'Choose your automated trade copier plan. Transparent pricing with instant Flutterwave activation and ultra-low latency execution.',
};

export default function PricingPage() {
  return <PricingClient />;
}
