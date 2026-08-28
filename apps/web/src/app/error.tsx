"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center p-4">
      <div className="plaiz-card p-8 md:p-12 max-w-md w-full flex flex-col items-center text-center rounded-[24px]">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-3">Connection Timeout</h2>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          We encountered a temporary issue connecting to the database. This is usually caused by a momentary network drop or connection pool limit.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background font-semibold h-11 rounded-full hover:bg-foreground/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center font-semibold h-11 rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
