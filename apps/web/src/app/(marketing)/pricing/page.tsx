import { Check, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background pt-24 pb-32 flex flex-col items-center">
      <div className="container max-w-4xl px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Enterprise-grade scale, simple pricing.</h1>
        <p className="text-lg text-muted-foreground mb-16 max-w-2xl mx-auto">
          Start copying trades with absolute precision today. Access to the full suite of Plaiz Markets infrastructure.
        </p>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">
          {/* Pro Plan */}
          <div className="plaiz-card p-8 flex flex-col relative border-primary/20">
            <div className="absolute top-0 right-8 -translate-y-1/2">
              <span className="plaiz-pill plaiz-pill-interactive bg-primary text-primary-foreground border-none">Most Popular</span>
            </div>
            <h3 className="text-2xl font-bold mb-2">Professional</h3>
            <p className="text-muted-foreground text-sm mb-6">For portfolio managers and serious traders.</p>
            <div className="mb-6">
              <span className="text-5xl font-bold tracking-tighter">$99</span>
              <span className="text-muted-foreground">/mo</span>
            </div>
            
            <ul className="flex flex-col gap-4 mb-8 flex-1">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Unlimited Sub Accounts</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Sub-millisecond Execution</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Advanced Risk Engine limits</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Fully Managed MT5 VPS</span>
              </li>
            </ul>
            
            <Link href="/login" className="plaiz-btn plaiz-btn-primary w-full justify-center text-center">
              Start Free Trial
            </Link>
          </div>

          {/* Enterprise */}
          <div className="plaiz-card bg-secondary/20 p-8 flex flex-col">
            <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
            <p className="text-muted-foreground text-sm mb-6">Custom infrastructure for prop firms.</p>
            <div className="mb-6">
              <span className="text-5xl font-bold tracking-tighter">Custom</span>
            </div>
            
            <ul className="flex flex-col gap-4 mb-8 flex-1 opacity-80">
              <li className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Dedicated Hardware Nodes</span>
              </li>
              <li className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">White-label dashboard</span>
              </li>
              <li className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Custom Risk API</span>
              </li>
            </ul>
            
            <Link href="mailto:contact@plaizmarkets.com" className="plaiz-btn plaiz-btn-secondary w-full justify-center text-center">
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
