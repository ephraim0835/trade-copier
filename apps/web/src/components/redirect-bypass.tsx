'use client';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function RedirectBypass() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && searchParams.get('ref') !== 'dashboard') {
      router.replace('/dashboard');
    }
  }, [status, searchParams, router]);

  return null;
}
