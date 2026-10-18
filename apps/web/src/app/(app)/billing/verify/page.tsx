import { Suspense } from 'react';
import { VerifyClient } from './verify-client';

export const dynamic = 'force-dynamic';

export default function BillingVerifyPage() {
  return (
    <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center min-h-[70vh]">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying payment with Flutterwave...</p>
        </div>
      }>
        <VerifyClient />
      </Suspense>
    </div>
  );
}
