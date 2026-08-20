'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isIosWithFallback: boolean;
  installApp: () => Promise<void>;
  dismissIosPrompt: () => void;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  isIosWithFallback: false,
  installApp: async () => {},
  dismissIosPrompt: () => {},
});

export const usePwa = () => useContext(PwaContext);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIosWithFallback, setIsIosWithFallback] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered with scope:', registration.scope);
        })
        .catch((err) => {
          console.error('SW registration failed:', err);
        });
    }

    // 2. Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // 3. Listen for Chrome/Android Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Prevent automatic prompt
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    // 4. iOS Fallback Logic
    // Safari on iOS does not support beforeinstallprompt, but it supports "Add to Home Screen"
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIos && !isStandalone) {
      // Show fallback instruction prompt if they haven't dismissed it
      const dismissed = localStorage.getItem('ios_pwa_prompt_dismissed');
      if (!dismissed) {
        setIsIosWithFallback(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    
    // Show the native browser prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const dismissIosPrompt = () => {
    setIsIosWithFallback(false);
    localStorage.setItem('ios_pwa_prompt_dismissed', 'true');
  };

  return (
    <PwaContext.Provider value={{ isInstallable, isInstalled, isIosWithFallback, installApp, dismissIosPrompt }}>
      {children}
    </PwaContext.Provider>
  );
}
