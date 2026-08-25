'use client';

import { Users } from 'lucide-react';
import Link from 'next/link';

export function RiskActions() {
  return (
    <Link 
      href="/accounts"
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm"
    >
      <Users className="w-4 h-4" />
      Manage Accounts
    </Link>
  );
}
