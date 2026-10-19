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
  ArrowRight
} from 'lucide-react';
import { useCurrency } from '@/components/currency-provider';
import { PricingAction } from '@/components/pricing-action';

export function PricingClient() {
  const { currency, setCurrency } = useCurrency();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isNgn = currency === 'NGN';

  const pricingPlans = [
    {
      id: "basic",
      name: "Basic",
      description: "For individual traders running a focused copy setup.",
      priceUSD: 26,
      priceNGN: 39000,
      mastersLimit: "1 Master Account",
      subsLimit: "Up to 3 Sub Accounts",
      speed: "<50ms Routing",
      features: [
        { text: "1 Master Account", included: true },
        { text: "Up to 3 Sub Accounts", included: true },
        { text: "Cross-Broker MT5 Execution", included: true },
        { text: "Standard Risk Management & SL/TP", included: true },
        { text: "Real-Time Trade Copying", included: true },
        { text: "Dashboard & Activity Telemetry", included: true },
        { text: "Managed VPS Infrastructure", included: true },
        { text: "Standard Support", included: true },
        { text: "Priority VPS Bridge Routing", included: false },
        { text: "Advanced Equity Guard & Trailing SL", included: false },
      ],
      cta: "Get Started",
      ctaUrl: "/signup?plan=basic",
      popular: false,
      status: "active"
    },
    {
      id: "pro",
      name: "Pro",
      description: "For serious traders managing a multi-broker portfolio.",
      priceUSD: 39,
      priceNGN: 58500,
      mastersLimit: "Up to 2 Master Accounts",
      subsLimit: "Up to 10 Sub Accounts",
      speed: "<15ms Dedicated Bridge",
      features: [
        { text: "Up to 2 Master Accounts", included: true },
        { text: "Up to 10 Sub Accounts", included: true },
        { text: "Cross-Broker MT5 Execution", included: true },
        { text: "Priority VPS Bridge Routing (<15ms)", included: true },
        { text: "Advanced Equity Guard & Trailing SL", included: true },
        { text: "Custom Lot Multipliers & Fixed Lots", included: true },
        { text: "Pending & Stop Order Synchronization", included: true },
        { text: "Live Floating PnL Stream (<1s)", included: true },
        { text: "Higher VPS Resource Allocation", included: true },
        { text: "Priority Support", included: true }
      ],
      cta: "Start with Pro",
      ctaUrl: "/signup?plan=pro",
      popular: true,
      status: "active"
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "Custom architecture for funds and high-frequency setups.",
      priceUSD: null,
      priceNGN: null,
      mastersLimit: "Unlimited Masters",
      subsLimit: "Custom Sub Allocations",
      speed: "<5ms Bare-Metal Routing",
      features: [
        { text: "Unlimited Master Accounts", included: true },
        { text: "Custom Sub Account Capacity", included: true },
        { text: "Dedicated Private VPS Hardware", included: true },
        { text: "Ultra-Low Latency Direct Cross-Connect", included: true },
        { text: "Custom Bridge Logic & API Access", included: true },
        { text: "24/7 Dedicated Account Manager", included: true },
      ],
      cta: "Talk to Us",
      ctaUrl: "mailto:support@plaiz-markets.online",
      popular: false,
      status: "coming_later"
    }
  ];

  const faqs = [
    {
      q: "Can I copy between different MT5 brokers?",
      a: "Yes! Plaiz Markets supports complete cross-broker copying. Your Master account can be with Exness, while your Sub accounts can be with FTMO, IC Markets, Tickmill, or any other broker supporting MetaTrader 5."
    },
    {
      q: "How fast is trade execution?",
      a: "Our Pro plan uses dedicated bridge routing running directly on low-latency infrastructure, syncing market orders, limit orders, and stop orders in under 15ms. Live dashboard telemetry updates in under 1 second without draining resources."
    },
    {
      q: "How do plan account limits work?",
      a: "Basic allows 1 Master account and up to 3 Sub accounts. Pro allows up to 2 Master accounts and up to 10 Sub accounts. You can upgrade or downgrade between plans at any time with immediate prorated access."
    },
    {
      q: "What payment methods are supported?",
      a: "Payments are processed securely via Flutterwave. We accept all major Credit and Debit Cards (Visa, Mastercard, Verve), direct Bank Transfers, and USSD for instant automated activation."
    },
    {
      q: "Do I need to keep my computer or laptop running?",
      a: "No! All trade execution and account connections run 24/7 on our managed VPS infrastructure. You can close your browser or mobile phone anytime—your trades will copy seamlessly around the clock."
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Transparent Trading Infrastructure Pricing</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6">
          Simple, Transparent <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-foreground">Pricing.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Choose the plan that fits your trading volume and portfolio size. All plans include automated 24/7 cloud execution with zero VPS management required.
        </p>

        {/* Currency Switcher */}
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
                {plan.status === 'coming_later' && (
                  <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{plan.description}</p>
            </div>
            
            <div className={`mb-6 ${plan.popular ? 'relative z-10' : ''}`}>
              {plan.priceUSD !== null ? (
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold tracking-tight">
                      {isNgn ? `₦${plan.priceNGN?.toLocaleString()}` : `$${plan.priceUSD}`}
                    </span>
                    <span className="text-muted-foreground text-sm font-medium">/month</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Billed monthly • Instant activation
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-[72px] justify-center">
                  <span className="text-4xl font-extrabold text-muted-foreground opacity-60">Custom</span>
                  <span className="text-xs text-muted-foreground mt-1">Tailored for funds and trading firms</span>
                </div>
              )}
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
                <span className="text-muted-foreground">Latency:</span>
                <span>{plan.speed}</span>
              </div>
            </div>
            
            <ul className={`flex flex-col gap-3.5 mb-10 flex-1 ${plan.popular ? 'relative z-10' : ''}`}>
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
            
            <PricingAction plan={plan} />
          </div>
        ))}
      </div>

      {/* Feature Comparison Matrix */}
      <div className="container mx-auto max-w-5xl px-4 mb-24">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">Compare Plan Capabilities</h2>
          <p className="text-sm text-muted-foreground">Comprehensive overview of what is included in each subscription tier.</p>
        </div>

        <div className="plaiz-card bg-card/60 rounded-3xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-bold text-foreground">Feature</th>
                  <th className="py-4 px-6 font-bold text-foreground">Basic</th>
                  <th className="py-4 px-6 font-bold text-primary">Pro (Recommended)</th>
                  <th className="py-4 px-6 font-bold text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs">
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Master Account Capacity</td>
                  <td className="py-3.5 px-6 text-muted-foreground">1 Master</td>
                  <td className="py-3.5 px-6 font-bold text-primary">Up to 2 Masters</td>
                  <td className="py-3.5 px-6 text-muted-foreground">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Sub Account Capacity</td>
                  <td className="py-3.5 px-6 text-muted-foreground">Up to 3 Subs</td>
                  <td className="py-3.5 px-6 font-bold text-primary">Up to 10 Subs</td>
                  <td className="py-3.5 px-6 text-muted-foreground">Custom allocation</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Execution Latency</td>
                  <td className="py-3.5 px-6 text-muted-foreground">&lt;50ms Cloud Routing</td>
                  <td className="py-3.5 px-6 font-bold text-primary">&lt;15ms Dedicated Bridge</td>
                  <td className="py-3.5 px-6 text-muted-foreground">&lt;5ms Bare Metal</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Cross-Broker MetaTrader 5</td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Pending & Stop Orders Sync</td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Advanced Equity Guard</td>
                  <td className="py-3.5 px-6 text-muted-foreground"><X className="w-4 h-4 text-muted-foreground/50" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Managed 24/7 Cloud VPS</td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                  <td className="py-3.5 px-6"><Check className="w-4 h-4 text-emerald-500" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-semibold text-foreground">Support Level</td>
                  <td className="py-3.5 px-6 text-muted-foreground">Standard Email</td>
                  <td className="py-3.5 px-6 font-bold text-primary">Priority Assistance</td>
                  <td className="py-3.5 px-6 text-muted-foreground">Dedicated Manager</td>
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
          <p className="text-sm text-muted-foreground">Everything you need to know about our subscriptions and trading infrastructure.</p>
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
