'use client';

import { Download, X } from 'lucide-react';
import { usePwa } from './pwa-provider';

import Image from 'next/image';

export function PwaInstallBanner() {
  const { isInstallable, installApp } = usePwa();

  if (!isInstallable) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[10px] bg-black/20 overflow-hidden shadow-sm border border-white/10 shrink-0">
          <Image src="/logo.png" alt="Plaiz Markets Logo" width={40} height={40} className="object-cover w-full h-full scale-[1.15]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold">Plaiz Markets App</span>
          <span className="text-[11px] opacity-80">Add to home screen for the best experience</span>
        </div>
      </div>
      <button
        onClick={installApp}
        className="bg-white/20 hover:bg-white/30 text-white transition-colors rounded-full py-1.5 px-4 text-[12px] font-medium flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        Install
      </button>
    </div>
  );
}
