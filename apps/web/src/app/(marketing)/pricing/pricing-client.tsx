'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Tag, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CreditCard,
  ArrowRight,
  MessageCircle,
  Clock
} from 'lucide-react';
import { useCurrency } from '@/components/currency-provider';
import { PricingAction } from '@/components/pricing-action';

interface PricingClientProps {
  userSubscription?: {
    planId: string | null;
    status: string;
  } | null;
}

export function PricingClient({ userSubscription }: PricingClientProps = {}) {
  const { currency, setCurrency, exchangeRate } = useCurrency();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isNgn = currency === 'NGN';
  const effectiveRate = exchangeRate > 0 ? exchangeRate : 1350;

  const pricingPlans = [
    {
      id: "starter",
      name: "Starter",
      description: "For individual traders running a focused copy setup.",
      priceUSD: 29,
      priceNGN: Math.round(29 * effectiveRate),
      mastersLimit: "1 Master Account",
      subsLimit: "Up to 3 Sub Accounts",
      speed: "<50ms Cloud Routing",
      features: [
        { text: "1 Master Account", included: true },
        { text: "Up to 3 Sub Accounts", included: true },
        { text: "Automatic Symbol Mapper (all brokers)", included: true },
        { text: "Cross-Broker MT5 Execution", included: true },
        { text: "All 4 Risk Multipliers (Fixed, Balance, Equity, Risk %)", included: true },
        { text: "All Order Types (Market, Limit, Stop)", included: true },
        { text: "Emergency Kill-Switch (Close All)", included: true },
        { text: "Real-Time Floating PnL Stream (<1s)", included: true },
        { text: "In-App Chat & WhatsApp Community", included: true },
        { text: "Priority Bridge Routing (<15ms)", included: false },
        { text: "Prop Firm Drawdown Guard", included: false },
      ],
      cta: "Get Started",
      ctaUrl: "/signup?plan=starter",
      popular: false,
      status: "active"
    },
    {
      id: "pro",
      name: "Pro",
      description: "For serious prop firm challengers & multi-account traders.",
      priceUSD: 49,
      priceNGN: Math.round(49 * effectiveRate),
      mastersLimit: "Up to 3 Master Accounts",
      subsLimit: "Up to 10 Sub Accounts",
      speed: "<15ms Dedicated Bridge",
      features: [
        { text: "Up to 3 Master Accounts", included: true },
        { text: "Up to 10 Sub Accounts", included: true },
        { text: "Automatic Symbol Mapper (all brokers)", included: true },
        { text: "Cross-Broker MT5 Execution", included: true },
        { text: "All 4 Risk Multipliers (Fixed, Balance, Equity, Risk %)", included: true },
        { text: "All Order Types (Market, Limit, Stop)", included: true },
        { text: "Priority Bridge Routing (<15ms)", included: true },
        { text: "Prop Firm Drawdown Guard (Daily Max Loss)", included: true },
        { text: "Priority In-App Chat (Top of Support Queue)", included: true },
        { text: "Independent Master & Sub Pairing", included: true },
        { text: "Higher VPS Hardware Allocation", included: true }
      ],
      cta: "Start with Pro",
      ctaUrl: "/signup?plan=pro",
      popular: true,
      status: "active"
    },
    {
      id: "elite",
      name: "Elite",
      description: "For fund managers, syndicates, and high-volume copy masters.",
      priceUSD: 99,
      priceNGN: Math.round(99 * effectiveRate),
      mastersLimit: "Up to 5 Master Accounts",
      subsLimit: "Up to 25 Sub Accounts",
      speed: "<10ms Priority Dedicated",
      features: [
        { text: "Up to 5 Master Accounts", included: true },
        { text: "Up to 25 Sub Accounts", included: true },
        { text: "Automatic Symbol Mapper (all brokers)", included: true },
        { text: "Cross-Broker MT5 Execution", included: true },
        { text: "All 4 Risk Multipliers (Fixed, Balance, Equity, Risk %)", included: true },
        { text: "All Order Types (Market, Limit, Stop)", included: true },
        { text: "Priority Dedicated VPS Hardware (<10ms)", included: true },
        { text: "Prop Firm Drawdown Guard (Daily Max Loss)", included: true },
        { text: "VIP Priority In-App Chat + Direct WhatsApp Desk", included: true },
        { text: "Independent Multi-Master Pairing", included: true },
        { text: "Custom Institutional Capacity", included: true }
      ],
      cta: "Start with Elite",
      ctaUrl: "/signup?plan=elite",
      popular: false,
      status: "active"
    }
  ];

  const faqs = [
    {
      q: "How does the 5-Day Free Trial work?",
      a: "Every new account automatically receives a 5-Day Free Trial with 1 Master and 1 Sub account. You can test live execution, symbol mapping, and risk controls across any MT5 broker with zero commitment before picking a plan."
    },
    {
      q: "Is the Symbol Auto-Mapper included on all plans?",
      a: "Yes! Every single plan (including the Free Trial) gets the full automatic symbol mapper. Whether your broker uses EURUSD, EURUSD.m, EURUSD.pro, or GOLD vs XAUUSD, trades translate seamlessly with zero configuration."
    },
    {
      q: "What risk calculation options do I have?",
      a: "All plans include all 4 risk sizing options: Fixed Lots (flat lot size), Balance Multiplier (scaled to balance ratio), Equity Multiplier (scaled to floating equity), and Risk % per trade (calculated using your Stop Loss distance)."
    },
    {
      q: "How does customer support work?",
      a: "All traders have access to our community WhatsApp group and our direct in-app live chat. For Pro and Elite subscribers, support requests are flagged with priority status and pushed to the top of our queue for fastest response."
    },
    {
      q: "Can I connect different MT5 brokers together?",
      a: "Yes. Plaiz Markets connects seamlessly across all MetaTrader 5 brokers globally (Exness, FTMO, IC Markets, Tickmill, FundedNext, etc.)."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden pb-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>

      {/* Hero Header */}
      <div className="container mx-auto max-w-7xl px-4 pt-24 text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-6 shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          <span>New Users Get a 5-Day Free Trial (1 Master + 1 Sub) • Zero Commitment</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6">
          Simple, Transparent <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-foreground">Pricing.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Built for prop firm challengers and professional portfolio managers. Automated 24/7 cloud execution with zero VPS maintenance.
        </p>

        {/* Currency Switcher */}
        <div className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center p-1.5 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/40 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-5 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-200 ${
                currency === 'USD'
                  ? 'bg-card text-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('NGN')}
              className={`px-5 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-200 ${
                currency === 'NGN'
                  ? 'bg-card text-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              NGN (₦)
            </button>
          </div>

          {/* Real-time FX Rate indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-border/30 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-time Rate: <strong>$1.00 USD ≈ ₦{Math.round(effectiveRate).toLocaleString()}</strong></span>
            <span className="text-[10px] opacity-60">• Auto-synced</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Tag className="w-3.5 h-3.5 text-primary" />
          <span>Have a discount or promo code? Enter it at checkout for instant savings.</span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto max-w-6xl px-4 grid md:grid-cols-3 gap-8 mb-24">
        {pricingPlans.map((plan) => (
          <div 
            key={plan.id}
            className={`plaiz-card bg-card p-8 flex flex-col relative overflow-hidden transition-all duration-300 ${
              plan.popular ? 'border-primary/50 shadow-2xl shadow-primary/20 scale-105 z-10' : 'hover:border-border/80'
            }`}
          >
            {plan.popular && (
              <>
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
              </>
            )}
            
            <div className={`mb-6 ${plan.popular ? 'relative z-10' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                {plan.popular && (
                  <span className="bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-primary/20">
                    <Sparkles className="w-3 h-3" /> Most Popular
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{plan.description}</p>
            </div>
            
            <div className={`mb-6 ${plan.popular ? 'relative z-10' : ''}`}>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold tracking-tight">
                    {isNgn ? `₦${plan.priceNGN?.toLocaleString()}` : `$${plan.priceUSD}`}
                  </span>
                  <span className="text-muted-foreground text-sm font-medium">/month</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Billed monthly • Instant activation via Flutterwave
                </div>
              </div>
            </div>

            {/* Quota Badges */}
            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/30 mb-8 flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between items-center font-semibold text-foreground">
                <span className="text-muted-foreground">Masters:</span>
                <span>{plan.mastersLimit}</span>
              </div>
              <div className="flex justify-between items-center font-semibold text-foreground">
                <span className="text-muted-foreground">Sub Accounts:</span>
                <span>{plan.subsLimit}</span>
              </div>
              <div className="flex justify-between items-center font-semibold text-primary">
                <span className="text-muted-foreground">Speed:</span>
                <span>{plan.speed}</span>
              </div>
            </div>
            
            <ul className={`flex flex-col gap-3 mb-10 flex-1 ${plan.popular ? 'relative z-10' : ''}`}>
              {plan.features.map((feature, i) => (
                <li key={i} className={`flex items-start gap-3 ${!feature.included ? 'opacity-40' : ''}`}>
                  {feature.included ? (
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs leading-relaxed font-medium">{feature.text}</span>
                </li>
              ))}
            </ul>
            
            <PricingAction plan={plan} userSubscription={userSubscription} />
          </div>
        ))}
      </div>

      {/* Feature Comparison Matrix */}
      <div className="container mx-auto max-w-5xl px-4 mb-24">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">Compare Plan Capabilities</h2>
          <p className="text-sm text-muted-foreground">Every tier includes our full trading engine. Upgrades scale your account capacity and priority routing.</p>
        </div>

        <div className="plaiz-card bg-card/60 rounded-3xl border border-border/40 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-bold text-foreground">Trading Feature</th>
                  <th className="py-4 px-6 font-bold text-foreground">Starter ($29)</th>
                  <th className="py-4 px-6 font-bold text-primary">Pro ($49)</th>
                  <th className="py-4 px-6 font-bold text-foreground">Elite ($99)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs">
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Master Account Capacity</td>
                  <td className="py-3.5 px-6 text-muted-foreground">1 Master</td>
                  <td className="py-3.5 px-6 font-bold text-primary">Up to 3 Masters</td>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Up to 5 Masters</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Sub Account Capacity</td>
                  <td className="py-3.5 px-6 text-muted-foreground">Up to 3 Subs</td>
                  <td className="py-3.5 px-6 font-bold text-primary">Up to 10 Subs</td>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Up to 25 Subs</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Automatic Symbol Mapper</td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">All 4 Risk Multipliers</td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">All Order Types (Market/Limit/Stop)</td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Execution Latency</td>
                  <td className="py-3.5 px-6 text-muted-foreground">&lt;50ms Cloud Routing</td>
                  <td className="py-3.5 px-6 font-bold text-primary">&lt;15ms Priority Bridge</td>
                  <td className="py-3.5 px-6 font-semibold text-foreground">&lt;10ms Dedicated</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Prop Firm Drawdown Guard</td>
                  <td className="py-3.5 px-6 text-muted-foreground"><X className="w-4 h-4 text-muted-foreground/40" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Customer Support</td>
                  <td className="py-3.5 px-6 text-muted-foreground">In-App Chat & WhatsApp</td>
                  <td className="py-3.5 px-6 font-bold text-primary">Priority In-App Chat (Top of Queue)</td>
                  <td className="py-3.5 px-6 font-semibold text-foreground">VIP Priority Desk</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="container mx-auto max-w-3xl px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">Frequently Asked Questions</h2>
          <p className="text-sm text-muted-foreground">Transparent answers to all your questions about our copy engine.</p>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index}
                className="plaiz-card bg-card/60 rounded-2xl border border-border/40 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full p-4 md:p-5 text-left flex items-center justify-between gap-4 font-semibold text-foreground text-sm hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                    {faq.q}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/20">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
