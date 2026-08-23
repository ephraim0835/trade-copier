'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('pwa-banner-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setIsVisible(true), 4000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS doesn't fire beforeinstallprompt — show manually
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    if (isIos && !isStandalone) {
      setTimeout(() => setIsVisible(true), 4000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="plaiz-card bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/30">
        {/* Logo */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
          <img src="/plaiz-logo.png" alt="Plaiz Markets" className="w-7 h-7 object-contain" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground leading-tight">Add to Home Screen</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Get the Plaiz Markets app</p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground text-[12px] font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
        >
          <Download className="w-3 h-3" />
          Install
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
