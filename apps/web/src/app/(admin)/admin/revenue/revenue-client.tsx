'use client';

import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  CreditCard, 
  Calendar, 
  ArrowUpRight, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Search, 
  Filter, 
  Percent, 
  Zap,
  Crown,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useCurrency } from '@/components/currency-provider';
import Link from 'next/link';

interface SerializedUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  accountCount: number;
  subscription: {
    id: string;
    status: string;
    planId: string | null;
    currentPeriodEnd: string | null;
    flutterwaveTxRef: string | null;
    discountPercentage: number;
    discountCode: string | null;
  } | null;
}

interface SerializedDiscount {
  id: string;
  code: string;
  percentage: number;
  duration: string;
  usedCount: number;
  maxUses: number | null;
  isActive: boolean;
  validUntil: string | null;
}

interface RevenueClientProps {
  users: SerializedUser[];
  discounts: SerializedDiscount[];
}

export function RevenueClient({ users, discounts }: RevenueClientProps) {
  const { currency, setCurrency, exchangeRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Plan standard pricing (in USD)
  const PLAN_PRICES_USD: Record<string, number> = {
    starter: 25,
    basic: 25,
    pro: 45,
    elite: 89,
  };

  // Convert USD amount to active display currency
  const formatMoney = (usdAmount: number) => {
    if (currency === 'NGN') {
      const ngnAmount = usdAmount * exchangeRate;
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(ngnAmount);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usdAmount);
  };

  // Compute live revenue metrics
  const metrics = useMemo(() => {
    let mrrUsd = 0;
    let activeSubscribers = 0;
    let trialSubscribers = 0;
    let internalFreeSubscribers = 0;
    let expiredSubscribers = 0;

    let starterPlanCount = 0;
    let proPlanCount = 0;
    let elitePlanCount = 0;
    let starterMrrUsd = 0;
    let proMrrUsd = 0;
    let eliteMrrUsd = 0;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let renewingSoonCount = 0;

    users.forEach((u) => {
      const sub = u.subscription;
      if (!sub) return;

      const planKey = (sub.planId || 'starter').toLowerCase();
      const basePrice = PLAN_PRICES_USD[planKey] || 25;
      const discountPct = sub.discountPercentage || 0;
      const effectivePrice = basePrice * ((100 - discountPct) / 100);

      if (sub.status === 'ACTIVE') {
        activeSubscribers++;
        mrrUsd += effectivePrice;

        if (planKey === 'elite') {
          elitePlanCount++;
          eliteMrrUsd += effectivePrice;
        } else if (planKey === 'pro') {
          proPlanCount++;
          proMrrUsd += effectivePrice;
        } else {
          starterPlanCount++;
          starterMrrUsd += effectivePrice;
        }

        // Check if renewing in the next 7 days
        if (sub.currentPeriodEnd) {
          const endDate = new Date(sub.currentPeriodEnd);
          if (endDate > now && endDate <= sevenDaysFromNow) {
            renewingSoonCount++;
          }
        }
      } else if (sub.status === 'TRIAL') {
        trialSubscribers++;
      } else if (sub.status === 'INTERNAL_FREE') {
        internalFreeSubscribers++;
      } else if (['PAST_DUE', 'CANCELED', 'EXPIRED'].includes(sub.status)) {
        expiredSubscribers++;
      }
    });

    const arrUsd = mrrUsd * 12;
    const arpuUsd = activeSubscribers > 0 ? mrrUsd / activeSubscribers : 0;
    const conversionRate = users.length > 0 ? (activeSubscribers / users.length) * 100 : 0;

    return {
      mrrUsd,
      arrUsd,
      activeSubscribers,
      trialSubscribers,
      internalFreeSubscribers,
      expiredSubscribers,
      starterPlanCount,
      proPlanCount,
      elitePlanCount,
      starterMrrUsd,
      proMrrUsd,
      eliteMrrUsd,
      arpuUsd,
      conversionRate,
      renewingSoonCount,
    };
  }, [users, exchangeRate]);

  // Filtered subscribers list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const subStatus = u.subscription?.status || 'NO_SUB';

      if (statusFilter === 'all') return matchesSearch;
      if (statusFilter === 'active') return matchesSearch && subStatus === 'ACTIVE';
      if (statusFilter === 'trial') return matchesSearch && subStatus === 'TRIAL';
      if (statusFilter === 'free') return matchesSearch && (subStatus === 'INTERNAL_FREE' || u.role === 'OWNER' || u.role === 'ADMIN');
      if (statusFilter === 'inactive') return matchesSearch && ['PAST_DUE', 'CANCELED', 'EXPIRED', 'NO_SUB'].includes(subStatus);
      return matchesSearch;
    });
  }, [users, searchTerm, statusFilter]);

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* HEADER WITH TITLE & CURRENCY SWITCHER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Revenue & Subscription Metrics</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Live recurring revenue, subscriber conversion, plan distribution, and recurring run rate.
          </p>
        </div>

        {/* Currency Switcher Toggle */}
        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-border/40 shrink-0 self-start md:self-auto">
          <button
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              currency === 'USD' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            USD ($)
          </button>
          <button
            onClick={() => setCurrency('NGN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              currency === 'NGN' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            NGN (₦)
          </button>
        </div>
      </div>

      {/* TOP 4 REVENUE METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="plaiz-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden border-border/50">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Monthly Recurring (MRR)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold num-tabular text-foreground">
              {formatMoney(metrics.mrrUsd)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-500">{metrics.activeSubscribers} paying</span>
              <span>across Starter, Pro & Elite plans</span>
            </div>
          </div>
        </div>

        {/* ARR Card */}
        <div className="plaiz-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden border-border/50">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Annualized Run Rate (ARR)</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold num-tabular text-foreground">
              {formatMoney(metrics.arrUsd)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span>Projected 12-month platform value</span>
            </div>
          </div>
        </div>

        {/* Active Paying Subscribers Card */}
        <div className="plaiz-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden border-border/50">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Paying Subscribers</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold num-tabular text-foreground flex items-baseline gap-2">
              <span>{metrics.activeSubscribers}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({metrics.conversionRate.toFixed(1)}% of {users.length} users)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className="text-amber-500 font-medium">{metrics.trialSubscribers} in trial</span>
              <span>&bull;</span>
              <span className="text-purple-500 font-medium">{metrics.internalFreeSubscribers} free/admin</span>
            </div>
          </div>
        </div>

        {/* Average Revenue Per User (ARPU) Card */}
        <div className="plaiz-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden border-border/50">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Average Rev. / User (ARPU)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold num-tabular text-foreground">
              {formatMoney(metrics.arpuUsd)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span>{metrics.renewingSoonCount} renewing in next 7 days</span>
            </div>
          </div>
        </div>
      </div>

      {/* PLAN BREAKDOWN & SUBSCRIPTION HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Breakdown Card (2 cols) */}
        <div className="plaiz-card p-6 rounded-2xl lg:col-span-2 border-border/50">
          <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Plan Distribution & Volume
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            Breakdown of active subscription revenue contribution by tier.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Starter Plan Box */}
            <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-foreground">Starter ($25)</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                  {metrics.starterPlanCount}
                </span>
              </div>
              <div className="text-xl font-bold num-tabular text-foreground">
                {formatMoney(metrics.starterMrrUsd)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ mo</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 mt-3 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full" 
                  style={{ width: `${metrics.mrrUsd > 0 ? (metrics.starterMrrUsd / metrics.mrrUsd) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Pro Plan Box */}
            <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm text-foreground">Pro ($45)</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {metrics.proPlanCount}
                </span>
              </div>
              <div className="text-xl font-bold num-tabular text-foreground">
                {formatMoney(metrics.proMrrUsd)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ mo</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 mt-3 overflow-hidden">
                <div 
                  className="bg-primary h-1.5 rounded-full" 
                  style={{ width: `${metrics.mrrUsd > 0 ? (metrics.proMrrUsd / metrics.mrrUsd) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Elite Plan Box */}
            <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-sm text-foreground">Elite ($89)</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                  {metrics.elitePlanCount}
                </span>
              </div>
              <div className="text-xl font-bold num-tabular text-foreground">
                {formatMoney(metrics.eliteMrrUsd)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ mo</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 mt-3 overflow-hidden">
                <div 
                  className="bg-purple-500 h-1.5 rounded-full" 
                  style={{ width: `${metrics.mrrUsd > 0 ? (metrics.eliteMrrUsd / metrics.mrrUsd) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Growth Scale Targets */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/40">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
              Monthly Revenue Scale Targets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-card border border-border/40">
                <span className="text-[10px] text-muted-foreground block">25 Pro Users</span>
                <span className="text-sm font-bold text-foreground num-tabular">{formatMoney(25 * 39)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/40">
                <span className="text-[10px] text-muted-foreground block">50 Pro Users</span>
                <span className="text-sm font-bold text-foreground num-tabular">{formatMoney(50 * 39)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/40">
                <span className="text-[10px] text-muted-foreground block">100 Pro Users</span>
                <span className="text-sm font-bold text-primary num-tabular">{formatMoney(100 * 39)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/40">
                <span className="text-[10px] text-muted-foreground block">250 Pro Users</span>
                <span className="text-sm font-bold text-emerald-500 num-tabular">{formatMoney(250 * 39)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Churn & Health Card (1 col) */}
        <div className="plaiz-card p-6 rounded-2xl flex flex-col justify-between border-border/50">
          <div>
            <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Subscriber Health
            </h2>
            <p className="text-xs text-muted-foreground mb-5">
              Renewal timelines and retention status.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-foreground">Active Paid</span>
                </div>
                <span className="text-xs font-bold text-foreground">{metrics.activeSubscribers}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-foreground">Renewing Next 7 Days</span>
                </div>
                <span className="text-xs font-bold text-amber-500">{metrics.renewingSoonCount}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-xs font-medium text-foreground">Trial Users</span>
                </div>
                <span className="text-xs font-bold text-blue-500">{metrics.trialSubscribers}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                  <span className="text-xs font-medium text-foreground">Expired / Canceled</span>
                </div>
                <span className="text-xs font-bold text-destructive">{metrics.expiredSubscribers}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
            <span>Active Discount Codes:</span>
            <Link href="/admin/discounts" className="text-primary hover:underline font-semibold flex items-center gap-1">
              {discounts.filter(d => d.isActive).length} configured
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* SUBSCRIBERS TABLE */}
      <div className="plaiz-card rounded-[20px] overflow-hidden border-border/50">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Subscriber Accounts & Revenue</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live list of all platform users, associated subscription states, and payment records.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-border/30 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-56"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-border/40">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'active' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('trial')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'trial' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Trial
              </button>
              <button
                onClick={() => setStatusFilter('free')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'free' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Free / Admin
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-black/5 dark:bg-white/5 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/30">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Plan</th>
                <th className="px-6 py-3.5">Monthly Value</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Next Renewal</th>
                <th className="px-6 py-3.5">Terminals</th>
                <th className="px-6 py-3.5">Payment Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 font-mono">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground font-sans">
                    No subscribers found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const sub = u.subscription;
                  const planKey = (sub?.planId || 'basic').toLowerCase();
                  const basePrice = PLAN_PRICES_USD[planKey] || 26;
                  const discountPct = sub?.discountPercentage || 0;
                  const effectivePrice = basePrice * ((100 - discountPct) / 100);

                  const isActive = sub?.status === 'ACTIVE';
                  const isFree = sub?.status === 'INTERNAL_FREE' || u.role === 'OWNER' || u.role === 'ADMIN';

                  let renewalText = 'N/A';
                  if (sub?.currentPeriodEnd) {
                    const diffDays = Math.round(
                      (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    renewalText = diffDays > 0 ? `in ${diffDays} day${diffDays === 1 ? '' : 's'}` : `Expired ${Math.abs(diffDays)}d ago`;
                  }

                  return (
                    <tr key={u.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      {/* User */}
                      <td className="px-6 py-4 font-sans">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block truncate max-w-[200px]">
                              {u.email}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Joined {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-6 py-4 font-sans">
                        {sub?.planId ? (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            planKey === 'elite'
                              ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                              : planKey === 'pro'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {planKey === 'elite' ? 'Elite Plan' : planKey === 'pro' ? 'Pro Plan' : 'Starter Plan'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">No Plan</span>
                        )}
                      </td>

                      {/* Monthly Value */}
                      <td className="px-6 py-4 font-bold text-foreground">
                        {isActive ? (
                          <div>
                            <span>{formatMoney(effectivePrice)}</span>
                            {discountPct > 0 && (
                              <span className="text-[10px] text-emerald-500 font-sans block">
                                -{discountPct}% ({sub?.discountCode})
                              </span>
                            )}
                          </div>
                        ) : isFree ? (
                          <span className="text-purple-400 font-sans text-xs">Complimentary</span>
                        ) : (
                          <span className="text-muted-foreground">$0.00</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 font-sans">
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        ) : sub?.status === 'TRIAL' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            TRIAL
                          </span>
                        ) : isFree ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                            INTERNAL FREE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                            {sub?.status || 'INACTIVE'}
                          </span>
                        )}
                      </td>

                      {/* Renewal */}
                      <td className="px-6 py-4 font-sans">
                        <span className={`text-xs ${
                          sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()
                            ? 'text-destructive font-semibold'
                            : 'text-muted-foreground'
                        }`}>
                          {renewalText}
                        </span>
                      </td>

                      {/* Terminals */}
                      <td className="px-6 py-4 font-bold text-foreground font-sans">
                        {u.accountCount} account{u.accountCount === 1 ? '' : 's'}
                      </td>

                      {/* Payment Ref */}
                      <td className="px-6 py-4">
                        {sub?.flutterwaveTxRef ? (
                          <span className="text-[10px] text-muted-foreground truncate block max-w-[140px]" title={sub.flutterwaveTxRef}>
                            {sub.flutterwaveTxRef}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
