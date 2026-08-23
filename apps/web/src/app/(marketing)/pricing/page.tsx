import Link from 'next/link';
import { Check, X } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden pb-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>

      <div className="container mx-auto max-w-7xl px-4 pt-24 text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6">
          Simple, Transparent <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-foreground">Pricing.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that fits your trading volume and portfolio size. All plans include ultra-low latency copying.
        </p>
      </div>

      <div className="container mx-auto max-w-6xl px-4 grid md:grid-cols-3 gap-8">
        {/* Personal Tier */}
        <div className="plaiz-card bg-card p-8 flex flex-col relative overflow-hidden">
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-2">Personal</h3>
            <p className="text-muted-foreground text-sm">Perfect for individual traders managing their own capital.</p>
          </div>
          <div className="mb-8">
            <span className="text-5xl font-extrabold">$29</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="flex flex-col gap-4 mb-10 flex-1">
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">1 Master Account</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Up to 3 Sub Accounts</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Standard Latency (~5ms)</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Basic Risk Limits</span></li>
            <li className="flex items-center gap-3 opacity-50"><X className="w-5 h-5" /><span className="text-sm">Cross-Broker Copying</span></li>
          </ul>
          <Link href="/login" className="plaiz-btn plaiz-btn-secondary w-full py-3 justify-center">Get Started</Link>
        </div>

        {/* Pro Tier (Highlighted) */}
        <div className="plaiz-card bg-card p-8 flex flex-col relative overflow-hidden border-primary/50 shadow-2xl shadow-primary/20 scale-105 z-10">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
          <div className="mb-8 relative z-10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-bold">Pro</h3>
              <span className="bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full">Most Popular</span>
            </div>
            <p className="text-muted-foreground text-sm">For serious prop firm traders and small fund managers.</p>
          </div>
          <div className="mb-8 relative z-10">
            <span className="text-5xl font-extrabold">$99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="flex flex-col gap-4 mb-10 flex-1 relative z-10">
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">3 Master Accounts</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Up to 15 Sub Accounts</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Ultra-Low Latency (&lt;1ms)</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Advanced Risk Engine</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Cross-Broker Copying</span></li>
          </ul>
          <Link href="/login" className="plaiz-btn plaiz-btn-primary w-full py-3 justify-center relative z-10">Start 7-Day Free Trial</Link>
        </div>

        {/* Enterprise Tier */}
        <div className="plaiz-card bg-card p-8 flex flex-col relative overflow-hidden">
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
            <p className="text-muted-foreground text-sm">For institutional funds managing significant capital.</p>
          </div>
          <div className="mb-8">
            <span className="text-5xl font-extrabold">$299</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="flex flex-col gap-4 mb-10 flex-1">
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Unlimited Master Accounts</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Unlimited Sub Accounts</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Dedicated Bare Metal Server</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">Custom Risk API</span></li>
            <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="text-sm">24/7 Priority Support</span></li>
          </ul>
          <Link href="/login" className="plaiz-btn plaiz-btn-secondary w-full py-3 justify-center">Contact Sales</Link>
        </div>
      </div>
    </div>
  );
}
