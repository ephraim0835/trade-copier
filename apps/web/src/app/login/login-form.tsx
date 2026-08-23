"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 p-10 plaiz-card bg-card/60 backdrop-blur-xl border border-border/50 rounded-[32px] shadow-2xl relative z-10 overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
      
      <div className="text-center flex flex-col items-center">
        <img src="/plaiz-logo.png" alt="Plaiz Markets Logo" className="h-12 w-auto mb-6" />
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Sign In</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Access your Plaiz Markets dashboard
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-xl relative block w-full px-4 py-3 pl-11 border border-border/50 placeholder-muted-foreground text-foreground bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="appearance-none rounded-xl relative block w-full px-4 py-3 pl-11 pr-11 border border-border/50 placeholder-muted-foreground text-foreground bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Forgot password link */}
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[12px] text-muted-foreground hover:text-primary transition-colors">
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="text-destructive text-[13px] text-center bg-destructive/10 py-3 rounded-xl border border-destructive/20 font-medium">
            {error}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="plaiz-btn plaiz-btn-primary w-full py-3.5 justify-center text-[14px]"
          >
            {loading ? "Authenticating..." : "Sign in to Dashboard"}
          </button>
        </div>
        
        <div className="text-center mt-6">
          <p className="text-[13px] text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="text-foreground font-medium hover:text-primary transition-colors">
              Create one now
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
