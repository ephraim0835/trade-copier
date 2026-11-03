'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  TrendingUp, 
  ShieldCheck, 
  Users, 
  ShieldAlert, 
  BarChart3, 
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TourStep {
  id: string;
  targetId: string;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    targetId: 'tour-welcome',
    badge: 'Introduction',
    title: 'Welcome to Plaiz Trade Copier',
    description: 'Your unified command center for institutional-grade trade replication. Mirror trades with ultra-low latency across unlimited MT5 accounts in the cloud.',
    icon: Sparkles,
    tip: 'Everything is synchronized in real time with our high-speed cloud VPS daemon.',
  },
  {
    id: 'vault',
    targetId: 'tour-vault',
    badge: 'Portfolio Overview',
    title: 'Live Portfolio Equity & Vault',
    description: 'The Glass Vault aggregates real-time equity, total vault balance, and live floating P/L across your entire account portfolio. Switch display currencies anytime with the currency selector.',
    icon: TrendingUp,
    tip: 'Real-time floating P/L streams live directly from your connected MT5 terminals.',
  },
  {
    id: 'master',
    targetId: 'tour-master',
    badge: 'Signal Provider',
    title: 'Master Account (Signal Source)',
    description: 'This is the primary trader or strategy account where trades originate. When a market order, limit order, or stop-loss change happens here, all linked sub accounts replicate it within milliseconds.',
    icon: ShieldCheck,
    tip: 'Click "Connect Master" to link your primary MT5 credentials securely.',
  },
  {
    id: 'subaccounts',
    targetId: 'tour-subaccounts',
    badge: 'Follower Accounts',
    title: 'Portfolio Sub Accounts',
    description: 'Connect personal accounts or prop firm challenges (FTMO, FundedNext, etc.). Each sub account can be independently monitored, reconnected, or configured with custom risk models.',
    icon: Users,
    tip: 'Add as many follower accounts as your active tier allows.',
  },
  {
    id: 'risk',
    targetId: 'tour-risk',
    badge: 'Capital Protection',
    title: 'Institutional Risk Engine',
    description: 'Protect your capital with custom risk settings. Configure fixed lot sizes, equity multipliers, percentage allocation, and automated daily drawdown protection per account.',
    icon: ShieldAlert,
    tip: 'Access the dedicated Risk Engine tab anytime from the navigation bar.',
  },
  {
    id: 'performance',
    targetId: 'tour-performance',
    badge: 'Analytics & Logs',
    title: 'Performance & Execution Stream',
    description: 'Monitor your portfolio equity curve over time and inspect real-time execution logs showing exact trade volumes, symbols, and timestamps.',
    icon: BarChart3,
    tip: 'Deals and closed trades are recorded with complete audit trails.',
  },
  {
    id: 'support',
    targetId: 'tour-support',
    badge: 'Help & Safety',
    title: '24/7 Support Desk & Bot Controls',
    description: 'Need assistance connecting a broker or configuring lot sizes? Open a support ticket or join our official WhatsApp trader community anytime. You also have a global Bot Kill-Switch in the top header.',
    icon: MessageSquare,
    tip: 'Our helpdesk desk responds within 15 minutes during live market hours.',
  },
];

interface DashboardWalkthroughProps {
  userId: string;
  hasAccounts?: boolean;
}

export function DashboardWalkthrough({ userId, hasAccounts = false }: DashboardWalkthroughProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const storageKey = `plaiz_walkthrough_seen_${userId}`;

  // Check screen width for mobile responsiveness
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-prompt new users with 0 accounts who haven't seen the tour yet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const hasSeen = localStorage.getItem(storageKey);
      // Auto-start ONLY for users who have not seen it AND have 0 connected accounts (new users)
      if (!hasSeen && !hasAccounts) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          setCurrentStepIndex(0);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey, hasAccounts]);

  // Listen for custom start event
  useEffect(() => {
    const handleStartTour = () => {
      setCurrentStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener('plaiz:start-walkthrough', handleStartTour);
    return () => window.removeEventListener('plaiz:start-walkthrough', handleStartTour);
  }, []);

  // Update target rect and scroll into view when step changes
  const updateSpotlight = useCallback(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }

    const currentStep = TOUR_STEPS[currentStepIndex];
    if (!currentStep) return;

    const el = document.getElementById(currentStep.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Smooth scroll if element is off screen
      const inView = 
        rect.top >= 50 && 
        rect.bottom <= window.innerHeight - 50;
      if (!inView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStepIndex]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [updateSpotlight]);

  // Handle keyboard shortcuts (Escape = Skip, Arrows = Nav)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  const markTourDismissed = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Ignore
    }
  };

  const handleSkip = () => {
    markTourDismissed();
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Finished
      markTourDismissed();
      setIsOpen(false);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // Calculate spotlight position
  const pad = 12;
  const spotlightTop = targetRect ? Math.max(0, targetRect.top - pad) : 0;
  const spotlightLeft = targetRect ? Math.max(0, targetRect.left - pad) : 0;
  const spotlightWidth = targetRect ? targetRect.width + pad * 2 : 0;
  const spotlightHeight = targetRect ? targetRect.height + pad * 2 : 0;

  return (
    <div className="fixed inset-0 z-[100000] overflow-hidden select-none pointer-events-auto">
      {/* Dark backdrop with cutout spotlight box-shadow */}
      {targetRect && (
        <div
          className="fixed rounded-2xl pointer-events-none transition-all duration-400 ease-out"
          style={{
            top: spotlightTop,
            left: spotlightLeft,
            width: spotlightWidth,
            height: spotlightHeight,
            boxShadow: '0 0 0 9999px rgba(10, 14, 23, 0.78)',
            border: '2px solid rgba(129, 140, 248, 0.65)',
          }}
        >
          {/* Subtle glowing pulse inside target cutout */}
          <div className="absolute inset-0 rounded-2xl ring-4 ring-primary/25 animate-pulse" />
        </div>
      )}

      {/* Fallback full backdrop if target rect not found */}
      {!targetRect && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-300"
          onClick={handleSkip}
        />
      )}

      {/* Tooltip Card Container */}
      <div 
        className={cn(
          "fixed z-[100002] transition-all duration-300",
          isMobile
            ? "bottom-4 left-4 right-4 max-w-md mx-auto"
            : "max-w-[440px]"
        )}
        style={!isMobile && targetRect ? {
          top: targetRect.bottom + 20 > window.innerHeight - 340 
            ? Math.max(20, targetRect.top - 360) 
            : targetRect.bottom + 16,
          left: Math.min(
            Math.max(20, targetRect.left + (targetRect.width / 2) - 220),
            window.innerWidth - 460
          ),
        } : (!isMobile ? {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : undefined)}
      >
        <div className="bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-primary/30 rounded-3xl p-5 sm:p-6 shadow-2xl ring-1 ring-white/10 flex flex-col gap-4 text-foreground animate-in fade-in zoom-in-95 duration-200">
          {/* Header row: Badge, Step counter, Close / Skip button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <StepIcon className="w-4 h-4" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                {currentStep.badge}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-semibold text-muted-foreground">
                {currentStepIndex + 1} / {TOUR_STEPS.length}
              </span>
              <button
                type="button"
                onClick={handleSkip}
                className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title="Skip Walkthrough"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar indicator */}
          <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary to-indigo-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${((currentStepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          {/* Body content */}
          <div className="space-y-2">
            <h3 className="text-base font-bold text-foreground tracking-tight leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentStep.description}
            </p>
            {currentStep.tip && (
              <div className="pt-2 flex items-start gap-2 text-[11px] text-primary/90 bg-primary/5 p-2.5 rounded-xl border border-primary/10">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                <span className="leading-normal">{currentStep.tip}</span>
              </div>
            )}
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors cursor-pointer"
            >
              Skip Tour
            </button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-primary/25 cursor-pointer"
              >
                <span>{isLastStep ? 'Get Started' : 'Next'}</span>
                {isLastStep ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Clean trigger button that can be embedded in headers or settings
 * to allow existing and new users to replay the walkthrough anytime.
 */
export function WalkthroughTriggerButton({ className }: { className?: string }) {
  const triggerTour = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plaiz:start-walkthrough'));
    }
  };

  return (
    <button
      type="button"
      onClick={triggerTour}
      className={cn(
        "flex items-center gap-1.5 px-3 h-9 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-all text-[11px] font-bold tracking-wide shadow-xs cursor-pointer",
        className
      )}
      title="Take a quick walkthrough of your dashboard"
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Dashboard Tour</span>
      <span className="sm:hidden">Tour</span>
    </button>
  );
}
