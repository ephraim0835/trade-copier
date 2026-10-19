'use client';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function RedirectBypass() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Never redirect if user navigated to #features, #infrastructure, or any anchor hash
    if (typeof window !== 'undefined') {
      if (window.location.hash && window.location.hash.length > 1) {
        return;
      }
      if (searchParams.get('view') === 'landing') {
        return;
      }
    }

    if (status === 'authenticated' && searchParams.get('ref') !== 'dashboard') {
      // Small timeout to allow any hash in the incoming URL to register
      const timeout = setTimeout(() => {
        if (!window.location.hash) {
          router.replace('/dashboard');
        }
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [status, searchParams, router]);

  return null;
}
