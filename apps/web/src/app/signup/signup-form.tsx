"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, User } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strength = getPasswordStrength(password);
  
  const getStrengthLabel = () => {
    if (password.length === 0) return "Enter a password";
    if (strength <= 1) return "Weak";
    if (strength === 2) return "Fair";
    if (strength === 3) return "Good";
    return "Strong";
  };

  const getStrengthColor = () => {
    if (strength <= 1) return "bg-destructive";
    if (strength === 2) return "bg-amber-500";
    if (strength >= 3) return "bg-emerald-500";
    return "bg-border";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create user using our Nest API
      // Since it's a demo flow, we mock standard error handling or assume API has a POST /auth/register
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001/api/v1';
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to create account");
        setLoading(false);
        return;
      }

      // Auto login after signup
      const loginRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (loginRes?.error) {
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 p-10 plaiz-card bg-card/60 backdrop-blur-xl border border-border/50 rounded-[32px] shadow-2xl relative z-10 overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
      
      <div className="text-center flex flex-col items-center">
        <img src="/plaiz-logo.png" alt="Plaiz Markets Logo" className="h-12 w-auto mb-6" />
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Create Account</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Join Plaiz Markets to start copying trades
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
          
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
            
            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="px-1 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex gap-1 h-1.5 w-full">
                  {[1, 2, 3, 4].map((level) => (
                    <div 
                      key={level} 
                      className={`flex-1 rounded-full transition-all duration-300 ${strength >= level ? getStrengthColor() : 'bg-black/10 dark:bg-white/10'}`} 
                    />
                  ))}
                </div>
                <span className={`text-[11px] font-medium transition-colors ${strength <= 1 ? 'text-destructive' : strength >= 3 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {getStrengthLabel()}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-destructive text-[13px] text-center bg-destructive/10 py-3 rounded-xl border border-destructive/20 font-medium animate-in fade-in">
            {error}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || password.length === 0 || strength < 2}
            className="plaiz-btn plaiz-btn-primary w-full py-3.5 justify-center text-[14px]"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </div>
        
        <div className="text-center mt-6">
          <p className="text-[13px] text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground font-medium hover:text-primary transition-colors">
              Sign in instead
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
