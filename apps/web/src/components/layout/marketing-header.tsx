'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function MarketingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl">
      <div className="bg-background/80 backdrop-blur-xl border border-border rounded-full px-6 py-3 flex items-center justify-between shadow-lg shadow-black/20">
        
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
          <img src="/plaiz-logo.png" alt="Plaiz Markets" className="h-6 w-auto" />
          <span className="font-bold text-[15px] tracking-tight hidden sm:inline-block">PLAIZ MARKETS</span>
        </Link>
        
        {/* Center: Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-muted-foreground">
          <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="/#infrastructure" className="hover:text-foreground transition-colors">Infrastructure</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </nav>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <Link href="/login" className="text-[13px] font-medium hover:text-primary transition-colors hidden sm:inline-block">
            Sign in
          </Link>
          <Link href="/dashboard" className="plaiz-btn plaiz-btn-primary rounded-full px-4 sm:px-5 py-1.5 text-[12px] sm:text-[13px]">
            Get Started
          </Link>
          
          {/* Mobile Hamburger Toggle */}
          <button 
            className="md:hidden p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-[110%] left-0 w-full bg-background border border-border rounded-2xl shadow-xl p-4 flex flex-col gap-4">
          <nav className="flex flex-col gap-3 text-sm font-medium">
            <Link href="/#features" className="hover:text-primary transition-colors px-2 py-1" onClick={() => setIsMenuOpen(false)}>Features</Link>
            <Link href="/#infrastructure" className="hover:text-primary transition-colors px-2 py-1" onClick={() => setIsMenuOpen(false)}>Infrastructure</Link>
            <Link href="/pricing" className="hover:text-primary transition-colors px-2 py-1" onClick={() => setIsMenuOpen(false)}>Pricing</Link>
          </nav>
          <div className="flex flex-col gap-2 pt-3 border-t border-border/50 sm:hidden">
             <Link href="/login" className="text-center font-medium hover:text-primary transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
               Sign in
             </Link>
          </div>
        </div>
      )}
    </div>
  );
}
