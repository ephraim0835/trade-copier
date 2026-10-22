'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  Loader2, 
  Tag, 
  Lock, 
  AlertCircle,
  ArrowRight,
  Zap,
  MessageCircle,
  Copy,
  Info
} from 'lucide-react';
import { useCurrency } from '@/components/currency-provider';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getPlanActionLabel, getPlanActionType } from '@/lib/plan-tiers';
import { useSubscription } from '@/components/subscription-provider';

export type PlanTier = 'starter' | 'pro' | 'elite' | 'basic';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlanId?: PlanTier;
  currentPlanId?: string | null;
  currentStatus?: string | null;
}

export function CheckoutModal({
  isOpen,
  onClose,
  initialPlanId = 'pro',
  currentPlanId,
  currentStatus,
}: CheckoutModalProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const sub = useSubscription();
  const { currency: globalCurrency, setCurrency: setGlobalCurrency, exchangeRate } = useCurrency();

  const [activePlanId, setActivePlanId] = useState<string | null | undefined>(currentPlanId ?? sub?.planId);
  const [activeStatus, setActiveStatus] = useState<string | null | undefined>(currentStatus ?? sub?.status);

  useEffect(() => {
    if (currentPlanId !== undefined) {
      setActivePlanId(currentPlanId);
    } else if (sub?.planId !== undefined) {
      setActivePlanId(sub.planId);
    }
    if (currentStatus !== undefined) {
      setActiveStatus(currentStatus);
    } else if (sub?.status !== undefined) {
      setActiveStatus(sub.status);
    }
  }, [currentPlanId, currentStatus, sub?.planId, sub?.status]);

  useEffect(() => {
    if (isOpen && session?.user?.email && (activePlanId === undefined || activeStatus === undefined)) {
      fetch('/api/billing/subscription')
        .then((res) => res.json())
        .then((data) => {
          if (data?.subscription) {
            setActivePlanId(data.subscription.planId);
            setActiveStatus(data.subscription.status);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, session?.user?.email, activePlanId, activeStatus]);

  const normalizePlan = (p: PlanTier): 'starter' | 'pro' | 'elite' => {
    if (p === 'basic' || p === 'starter') return 'starter';
    if (p === 'elite') return 'elite';
    return 'pro';
  };

  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'elite'>(normalizePlan(initialPlanId));
  const [currency, setCurrency] = useState<'USD' | 'NGN'>(globalCurrency || 'USD');
  const [discountCode, setDiscountCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    percentage: number;
    savings: number;
    finalAmount: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  useEffect(() => {
    setSelectedPlan(normalizePlan(initialPlanId));
  }, [initialPlanId]);

  useEffect(() => {
    if (globalCurrency) {
      setCurrency(globalCurrency);
    }
  }, [globalCurrency]);

  useEffect(() => {
    if (!isOpen) {
      setDiscountError(null);
      setCheckoutError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isNgn = currency === 'NGN';
  const effectiveNgnRate = exchangeRate > 0 ? exchangeRate : 1350;
  const basePrices = {
    starter: isNgn ? Math.round(29 * effectiveNgnRate) : 29,
    pro: isNgn ? Math.round(49 * effectiveNgnRate) : 49,
    elite: isNgn ? Math.round(99 * effectiveNgnRate) : 99,
  };

  const planQuota = {
    starter: {
      name: 'Starter Plan',
      masters: '1 Master Account',
      subs: 'Up to 3 Sub Accounts',
      speed: '<50ms Cloud Routing',
      hasDrawdownGuard: false,
      prioritySupport: false,
    },
    pro: {
      name: 'Pro Plan',
      masters: 'Up to 3 Master Accounts',
      subs: 'Up to 10 Sub Accounts',
      speed: '<15ms Priority Bridge',
      hasDrawdownGuard: true,
      prioritySupport: true,
    },
    elite: {
      name: 'Elite Plan',
      masters: 'Up to 5 Master Accounts',
      subs: 'Up to 25 Sub Accounts',
      speed: '<10ms Priority Dedicated',
      hasDrawdownGuard: true,
      prioritySupport: true,
    },
  };

  const currentBasePrice = basePrices[selectedPlan];
  const currentSavings = appliedDiscount 
    ? Math.round((currentBasePrice * (appliedDiscount.percentage / 100)) * 100) / 100 
    : 0;
  const finalPrice = Math.max(1, currentBasePrice - currentSavings);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      setDiscountError('Please enter a coupon or promo code.');
      return;
    }

    setIsValidatingCode(true);
    setDiscountError(null);

    try {
      const res = await fetch('/api/billing/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: discountCode.trim().toUpperCase(),
          planId: selectedPlan,
          currency,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedDiscount(null);
        setDiscountError(data.error || 'Invalid discount code.');
      } else {
        setAppliedDiscount({
          code: data.code,
          percentage: data.percentage,
          savings: data.savings,
          finalAmount: data.finalAmount,
        });
        setDiscountError(null);
      }
    } catch (err: any) {
      setDiscountError(err.message || 'Failed to check discount code.');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError(null);
  };

  const handleCurrencySwitch = (newCurrency: 'USD' | 'NGN') => {
    setCurrency(newCurrency);
    setGlobalCurrency(newCurrency);
    if (appliedDiscount) {
      setAppliedDiscount(null);
    }
  };

  const handleProceedToPayment = async () => {
    if (!session?.user?.email) {
      router.push(`/signup?redirect=/pricing`);
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          currency,
          discountCode: appliedDiscount?.code || (discountCode.trim() ? discountCode.trim().toUpperCase() : undefined),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize payment gateway.');
      }

      if (data.link) {
        window.location.href = data.link;
      } else {
        throw new Error('No payment checkout link returned.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Payment provider is currently unavailable. Please try again shortly.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="plaiz-card bg-card border border-border/60 max-w-lg w-full rounded-[28px] p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-5 max-h-[95vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Secure Checkout
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
              {getPlanActionLabel(selectedPlan, activePlanId, activeStatus)} Plan
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated ultra-low latency trade copying across all your MT5 accounts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plan Selector & Currency Switcher */}
        <div className="flex flex-col gap-2.5 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Plan Tier</span>
            <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => handleCurrencySwitch('USD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  currency === 'USD'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => handleCurrencySwitch('NGN')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  currency === 'NGN'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                NGN (₦)
              </button>
            </div>
          </div>

          {/* Real-time Forex Conversion Indicator */}
          <div className="flex items-center justify-between text-[11px] px-1 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-time Rate: $1.00 USD ≈ ₦{Math.round(effectiveNgnRate).toLocaleString()}</span>
            </span>
            <span className="text-[10px] opacity-75">Updated live</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Starter Option */}
            <button
              type="button"
              onClick={() => setSelectedPlan('starter')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                selectedPlan === 'starter'
                  ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/30'
                  : 'bg-card/40 border-border/40 hover:border-border/80'
              }`}
            >
              <div className="text-xs font-bold text-foreground truncate flex items-center justify-between">
                <span>Starter</span>
                {(() => {
                  const act = getPlanActionType('starter', activePlanId, activeStatus);
                  if (act === 'RENEW') return <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Current</span>;
                  if (act === 'DOWNGRADE') return <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Downgrade</span>;
                  return null;
                })()}
              </div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">
                {isNgn ? `₦${basePrices.starter.toLocaleString()}` : '$29'}<span className="text-[9px] text-muted-foreground font-normal">/mo</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                1 M • 3 Subs
              </div>
            </button>

            {/* Pro Option */}
            <button
              type="button"
              onClick={() => setSelectedPlan('pro')}
              className={`p-3 rounded-2xl border text-left relative transition-all ${
                selectedPlan === 'pro'
                  ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40'
                  : 'bg-card/40 border-border/40 hover:border-border/80'
              }`}
            >
              <div className="text-xs font-bold text-primary flex items-center justify-between">
                <span>Pro</span>
                {(() => {
                  const act = getPlanActionType('pro', activePlanId, activeStatus);
                  if (act === 'RENEW') return <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Current</span>;
                  if (act === 'DOWNGRADE') return <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Downgrade</span>;
                  return <Sparkles className="w-2.5 h-2.5" />;
                })()}
              </div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">
                {isNgn ? `₦${basePrices.pro.toLocaleString()}` : '$49'}<span className="text-[9px] text-muted-foreground font-normal">/mo</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                3 M • 10 Subs
              </div>
            </button>

            {/* Elite Option */}
            <button
              type="button"
              onClick={() => setSelectedPlan('elite')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                selectedPlan === 'elite'
                  ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40'
                  : 'bg-card/40 border-border/40 hover:border-border/80'
              }`}
            >
              <div className="text-xs font-bold text-foreground truncate flex items-center justify-between">
                <span>Elite</span>
                {(() => {
                  const act = getPlanActionType('elite', activePlanId, activeStatus);
                  if (act === 'RENEW') return <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Current</span>;
                  if (act === 'UPGRADE') return <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Upgrade</span>;
                  return null;
                })()}
              </div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">
                {isNgn ? `₦${basePrices.elite.toLocaleString()}` : '$99'}<span className="text-[9px] text-muted-foreground font-normal">/mo</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                5 M • 25 Subs
              </div>
            </button>
          </div>
        </div>

        {/* Plan Features & Perks */}
        <div className="bg-black/5 dark:bg-white/5 p-3.5 rounded-2xl border border-border/30 text-xs flex flex-col gap-2 relative z-10">
          <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-primary" />
            {planQuota[selectedPlan].name} Includes:
          </div>
          <div className="grid grid-cols-2 gap-2 text-foreground font-medium text-[11px]">
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{planQuota[selectedPlan].masters}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{planQuota[selectedPlan].subs}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>Symbol Auto-Mapper</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>All 4 Risk Multipliers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{planQuota[selectedPlan].speed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {planQuota[selectedPlan].hasDrawdownGuard ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="text-primary font-semibold">Prop Firm Drawdown Guard</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>Emergency Kill-Switch</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Promo / Discount Code Box */}
        <div className="flex flex-col gap-1.5 relative z-10">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" /> Promo / Discount Code
          </label>

          {appliedDiscount ? (
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <div>
                  <span className="font-bold text-emerald-500 uppercase">{appliedDiscount.code}</span>
                  <span className="text-muted-foreground ml-1.5">
                    ({appliedDiscount.percentage}% off applied)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveDiscount}
                className="text-[11px] text-muted-foreground hover:text-foreground font-semibold hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyDiscount();
                  }
                }}
                placeholder="e.g. WELCOME20"
                className="flex-1 bg-background border border-border/50 rounded-xl px-3.5 py-2.5 text-xs font-mono uppercase tracking-wider text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleApplyDiscount}
                disabled={isValidatingCode || !discountCode.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border/50 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isValidatingCode && <Loader2 className="w-3 h-3 animate-spin" />}
                Apply
              </button>
            </div>
          )}

          {discountError && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" /> {discountError}
            </p>
          )}
        </div>

        {/* Pricing Summary */}
        <div className="border-t border-border/30 pt-3 flex flex-col gap-2 relative z-10">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span>{isNgn ? `₦${currentBasePrice.toLocaleString()}` : `$${currentBasePrice.toFixed(2)}`}</span>
          </div>

          {appliedDiscount && (
            <div className="flex justify-between items-center text-xs text-emerald-500 font-medium">
              <span>Promotional Discount ({appliedDiscount.percentage}%)</span>
              <span>-{isNgn ? `₦${currentSavings.toLocaleString()}` : `$${currentSavings.toFixed(2)}`}</span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-1">
            <span className="text-sm font-bold text-foreground">Total Due Today</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black tracking-tight text-foreground">
                {isNgn ? `₦${finalPrice.toLocaleString()}` : `$${finalPrice.toFixed(2)}`}
              </span>
              <span className="text-xs text-muted-foreground">/ month</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {checkoutError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{checkoutError}</span>
          </div>
        )}

        {/* Flutterwave Sandbox / Card Guidance Helper */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs flex flex-col gap-2.5 relative z-10">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-500 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Info className="w-3.5 h-3.5" /> Flutterwave Test Card (Sandbox Active)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-mono font-bold">
              TEST GATEWAY
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Real bank cards trigger <em>&quot;Sorry an error occurred while processing your card&quot;</em> in test mode. Click below to copy sandbox test card:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => copyToClipboard('5531886652142950', 'card')}
              className="p-1.5 rounded-xl bg-card border border-border/60 hover:border-primary/60 flex items-center justify-between text-left transition-colors cursor-pointer"
              title="Click to copy Card Number"
            >
              <div>
                <div className="text-[9px] text-muted-foreground font-sans">CARD NO</div>
                <div className="font-bold text-foreground truncate">5531••2950</div>
              </div>
              {copiedField === 'card' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>

            <button
              type="button"
              onClick={() => copyToClipboard('09/32', 'exp')}
              className="p-1.5 rounded-xl bg-card border border-border/60 hover:border-primary/60 flex items-center justify-between text-left transition-colors cursor-pointer"
              title="Click to copy Expiry Date"
            >
              <div>
                <div className="text-[9px] text-muted-foreground font-sans">EXPIRY</div>
                <div className="font-bold text-foreground">09/32</div>
              </div>
              {copiedField === 'exp' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>

            <button
              type="button"
              onClick={() => copyToClipboard('564', 'cvv')}
              className="p-1.5 rounded-xl bg-card border border-border/60 hover:border-primary/60 flex items-center justify-between text-left transition-colors cursor-pointer"
              title="Click to copy CVV"
            >
              <div>
                <div className="text-[9px] text-muted-foreground font-sans">CVV</div>
                <div className="font-bold text-foreground">564</div>
              </div>
              {copiedField === 'cvv' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>

            <button
              type="button"
              onClick={() => copyToClipboard('3310', 'pin')}
              className="p-1.5 rounded-xl bg-card border border-border/60 hover:border-primary/60 flex items-center justify-between text-left transition-colors cursor-pointer"
              title="Click to copy PIN"
            >
              <div>
                <div className="text-[9px] text-muted-foreground font-sans">PIN / OTP</div>
                <div className="font-bold text-foreground">3310 / 12345</div>
              </div>
              {copiedField === 'pin' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>

          <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5 pt-1.5 border-t border-amber-500/20">
            <div>
              <span className="font-bold text-foreground">🇳🇬 Paying with a Nigerian Bank?</span> Ensure you selected <strong>NGN (₦)</strong> above. Standard Naira cards reject foreign USD charges due to CBN FX policy.
            </div>
            <div>
              <span className="font-bold text-foreground">💡 Tip:</span> On the Flutterwave screen, you can also select <strong>&quot;Pay with Bank Transfer&quot;</strong> or <strong>USSD</strong> for instant direct settlement.
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-2.5 relative z-10">
          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-2xl text-xs md:text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting to Flutterwave...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Proceed with {getPlanActionLabel(selectedPlan, activePlanId, activeStatus)}
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> Cards, Bank Transfer, USSD
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 256-bit Encrypted
            </span>
            <span>•</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
