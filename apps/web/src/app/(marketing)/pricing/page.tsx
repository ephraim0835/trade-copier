import Link from 'next/link';
import { Check, X } from 'lucide-react';

const pricingPlans = [
  {
    id: "personal",
    name: "Personal",
    description: "For individual traders running a focused copy setup.",
    priceUSD: 19,
    priceNGN: 28500,
    features: [
      { text: "1 Master Account", included: true },
      { text: "Up to 3 Sub Accounts", included: true },
      { text: "Cross-Broker MT5", included: true },
      { text: "Risk Management", included: true },
      { text: "Real-Time Trade Copying", included: true },
      { text: "Dashboard & Activity", included: true },
      { text: "Managed VPS infrastructure", included: true },
      { text: "Standard Support", included: true }
    ],
    cta: "Get Started",
    ctaUrl: "/signup",
    popular: false,
    status: "active"
  },
  {
    id: "pro",
    name: "Pro",
    description: "For serious traders managing a larger portfolio.",
    priceUSD: 39,
    priceNGN: 58500,
    features: [
      { text: "Up to 2 Master Accounts", included: true },
      { text: "Up to 10 Sub Accounts", included: true },
      { text: "Everything in Personal", included: true },
      { text: "Advanced Risk Controls", included: true },
      { text: "Multiple Copier Configurations", included: true },
      { text: "Performance Analytics", included: true },
      { text: "Priority Support", included: true },
      { text: "Higher Infrastructure Allocation", included: true }
    ],
    cta: "Start with Pro",
    ctaUrl: "/signup",
    popular: true,
    status: "active"
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Built for larger trading operations.",
    priceUSD: null,
    priceNGN: null,
    features: [
      { text: "Available upon infrastructure maturity", included: true }
    ],
    cta: "Talk to us",
    ctaUrl: "mailto:support@plaiz-markets.online",
    popular: false,
    status: "coming_later"
  }
];

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
        {pricingPlans.map((plan) => (
          <div 
            key={plan.id}
            className={`plaiz-card bg-card p-8 flex flex-col relative overflow-hidden ${
              plan.popular ? 'border-primary/50 shadow-2xl shadow-primary/20 scale-105 z-10' : ''
            }`}
          >
            {plan.popular && (
              <>
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
              </>
            )}
            
            <div className={`mb-8 ${plan.popular ? 'relative z-10' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                {plan.popular && (
                  <span className="bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full">Most Popular</span>
                )}
                {plan.status === 'coming_later' && (
                  <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full">Coming Later</span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{plan.description}</p>
            </div>
            
            <div className={`mb-8 ${plan.popular ? 'relative z-10' : ''}`}>
              {plan.priceUSD !== null ? (
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold">${plan.priceUSD}</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-semibold text-muted-foreground">₦{plan.priceNGN?.toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-[84px] justify-center">
                  <span className="text-4xl font-extrabold text-muted-foreground opacity-50">Custom</span>
                </div>
              )}
            </div>
            
            <ul className={`flex flex-col gap-4 mb-10 flex-1 ${plan.popular ? 'relative z-10' : ''}`}>
              {plan.features.map((feature, i) => (
                <li key={i} className={`flex items-start gap-3 ${!feature.included ? 'opacity-50' : ''}`}>
                  {feature.included ? (
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <span className="text-sm leading-relaxed">{feature.text}</span>
                </li>
              ))}
            </ul>
            
            <Link 
              href={plan.ctaUrl} 
              className={`plaiz-btn w-full py-3 justify-center ${plan.popular ? 'plaiz-btn-primary relative z-10' : 'plaiz-btn-secondary'}`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
