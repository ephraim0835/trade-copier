'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export function MarketingHeader() {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl">
      <div className="bg-background/80 backdrop-blur-xl border border-border rounded-full px-6 py-3 flex items-center justify-between shadow-lg shadow-black/20">
        
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/plaiz-logo.png" alt="Plaiz Markets" className="h-6 w-auto" />
          <span className="font-bold text-[15px] tracking-tight hidden sm:inline-block">PLAIZ MARKETS</span>
        </Link>
        
        {/* Center: Nav */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-muted-foreground">
          <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="/#infrastructure" className="hover:text-foreground transition-colors">Infrastructure</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </nav>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/login" className="text-[13px] font-medium hover:text-primary transition-colors hidden sm:inline-block">
            Sign in
          </Link>
          <Link href="/dashboard" className="plaiz-btn plaiz-btn-primary rounded-full px-5 py-1.5 text-[13px]">
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
