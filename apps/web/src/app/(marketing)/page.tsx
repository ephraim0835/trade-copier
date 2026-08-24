import Link from 'next/link';
import { Shield, Zap, Lock, Globe, Server, BarChart3, ChevronRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { RedirectBypass } from '@/components/redirect-bypass';

export default async function MarketingHomepage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <RedirectBypass />      {/* Hero Section */}
      <section className="relative pt-24 pb-32 lg:pt-36 lg:pb-48 flex items-center justify-center flex-col text-center px-4 z-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        
        <div className="plaiz-plaiz-pill plaiz-pill-neutral mb-8">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Now accepting beta users
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter max-w-4xl leading-[1.1] mb-6">
          Institutional Trade Copying, <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-foreground">
            Built for Scale.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          Plaiz Markets provides ultra-low latency trade execution, absolute risk control, and enterprise-grade VPS infrastructure for serious portfolio managers.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/dashboard" className="plaiz-btn plaiz-btn-primary text-base h-12 px-8 rounded-full shadow-lg shadow-primary/25">
            Start Copying
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
          <a href="#features" className="plaiz-btn plaiz-btn-secondary text-base h-12 px-8 rounded-full">
            Explore Features
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-card/30 border-y border-border/40 relative z-10">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Master Your Portfolio</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Connect multiple broker accounts and seamlessly mirror trades from your master account to endless sub accounts with microscopic precision.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="plaiz-card p-8 bg-card flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Sub-Millisecond Execution</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our custom MQL5 gateway routes trades from Master to Sub accounts instantly, ensuring minimal slippage and identical entries.
              </p>
            </div>
            <div className="plaiz-card p-8 bg-card flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Absolute Risk Control</h3>
              <p className="text-muted-foreground leading-relaxed">
                Enforce daily drawdowns, custom multipliers, and mandatory stop-losses. The Risk Engine intercepts dangerous trades before they execute.
              </p>
            </div>
            <div className="plaiz-card p-8 bg-card flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-6">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Multi-Broker Support</h3>
              <p className="text-muted-foreground leading-relaxed">
                Don't be locked into a single ecosystem. Plaiz Markets connects seamlessly to any MT5 terminal globally.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure CTA */}
      <section id="infrastructure" className="py-32 relative z-10 overflow-hidden">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="plaiz-card bg-[#09090b] border-[#27272a] text-white p-12 md:p-16 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden shadow-2xl">
            {/* Background glowing orb */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="max-w-2xl z-10">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <Server className="w-5 h-5" />
                <span className="font-semibold tracking-wide uppercase text-sm">Managed VPS Infrastructure</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                We handle the servers.<br/> You handle the trading.
              </h2>
              <p className="text-[#a1a1aa] text-lg leading-relaxed mb-8">
                Forget maintaining Windows servers or dealing with terminal crashes. We automatically provision isolated MT5 environments on our high-performance cloud architecture.
              </p>
              <ul className="flex flex-col gap-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary"><Lock className="w-3 h-3"/></div>
                  <span className="text-sm font-medium">Bank-grade credential encryption</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary"><BarChart3 className="w-3 h-3"/></div>
                  <span className="text-sm font-medium">24/7 terminal health monitoring</span>
                </li>
              </ul>
            </div>
            
            <div className="hidden lg:block relative z-10 flex-shrink-0">
               {/* Decorative server graphic */}
               <div className="w-64 h-80 bg-[#121214] rounded-2xl border border-[#27272a] shadow-2xl flex flex-col p-4 gap-4">
                 <div className="w-full h-8 bg-[#1f1f22] rounded-md flex items-center px-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
                   <div className="h-2 w-24 bg-[#27272a] rounded"></div>
                 </div>
                 <div className="w-full h-8 bg-[#1f1f22] rounded-md flex items-center px-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                   <div className="h-2 w-32 bg-[#27272a] rounded"></div>
                 </div>
                 <div className="w-full h-8 bg-[#1f1f22] rounded-md flex items-center px-3">
                   <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                   <div className="h-2 w-20 bg-[#27272a] rounded"></div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get the App */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <div className="plaiz-card bg-card/50 border border-border/50 rounded-[32px] px-8 py-12 flex flex-col items-center gap-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent -z-0"></div>
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/50 flex items-center justify-center shadow-sm">
                <img src="/plaiz-logo.png" alt="Plaiz Markets" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Available as an App</h2>
                <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
                  Install Plaiz Markets on your device for a native app experience — no App Store required.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-center text-[13px] text-muted-foreground">
                <div className="flex items-center gap-2 bg-secondary/50 border border-border/50 rounded-full px-4 py-2">
                  <span>📱</span>
                  <span><strong className="text-foreground">iPhone:</strong> Safari → Share → Add to Home Screen</span>
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 border border-border/50 rounded-full px-4 py-2">
                  <span>🤖</span>
                  <span><strong className="text-foreground">Android:</strong> Chrome → Menu → Add to Home Screen</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 mt-auto">
        <div className="container mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/plaiz-logo.png" alt="Plaiz Markets" className="h-6 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" />
            <span className="font-semibold text-muted-foreground">PLAIZ MARKETS</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Plaiz Markets. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
