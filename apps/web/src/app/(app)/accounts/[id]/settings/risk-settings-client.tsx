'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Info, Percent, Layers, Scale, DollarSign, CheckCircle2, Shield } from 'lucide-react';
import { updateAccountRiskSettings } from '@/app/actions/account-actions';

type RiskSettingsProps = {
  accountId: string;
  initialSettings: any;
};

export function RiskSettingsClient({ accountId, initialSettings }: RiskSettingsProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    displayName: initialSettings.displayName || '',
    riskType: initialSettings.riskType || 'RISK_PERCENT',
    fixedLotSize: initialSettings.fixedLotSize?.toString() || '0.01',
    lotMultiplier: initialSettings.lotMultiplier?.toString() || '1.0',
    riskPercentage: initialSettings.riskPercentage?.toString() || '1.0',
    roundingTolerancePct: initialSettings.roundingTolerancePct?.toString() || '2.0',
    dailyRiskEnabled: initialSettings.dailyRiskEnabled || false,
    maxDailyRisk: initialSettings.maxDailyRisk?.toString() || '0',
    maxTradesEnabled: initialSettings.maxTradesEnabled || false,
    maxActiveTrades: initialSettings.maxActiveTrades?.toString() || '0',
    requireTp: initialSettings.requireTp || false,
    missingSlTimeoutSec: initialSettings.missingSlTimeoutSec?.toString() || '60',
    maxRecoveryRRDegradation: initialSettings.maxRecoveryRRDegradation?.toString() || '0.5',
    maxLotCap: initialSettings.maxLotCap ? initialSettings.maxLotCap.toString() : '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    let parsedValue: any = value;
    if (type === 'checkbox') parsedValue = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
    }));
    setSuccess(false);
    setError(null);
  };

  const handleSelectRiskType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      riskType: type
    }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        displayName: formData.displayName || null,
        riskType: formData.riskType,
        fixedLotSize: Number(formData.fixedLotSize),
        lotMultiplier: Number(formData.lotMultiplier),
        riskPercentage: Number(formData.riskPercentage),
        roundingTolerancePct: Number(formData.roundingTolerancePct),
        dailyRiskEnabled: formData.dailyRiskEnabled,
        maxDailyRisk: Number(formData.maxDailyRisk),
        maxTradesEnabled: formData.maxTradesEnabled,
        maxActiveTrades: Number(formData.maxActiveTrades),
        requireTp: formData.requireTp,
        missingSlTimeoutSec: Number(formData.missingSlTimeoutSec),
        maxRecoveryRRDegradation: Number(formData.maxRecoveryRRDegradation),
        maxLotCap: formData.maxLotCap && formData.maxLotCap.trim() ? Number(formData.maxLotCap) : null,
      };

      const result = await updateAccountRiskSettings(accountId, payload);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-10">
      
      {/* 1. Account Details */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-3">Account Identification</h2>
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Display Name (Optional)</label>
            <input 
              type="text" name="displayName" placeholder="e.g. Headway NGN Challenge or FTMO 100k"
              value={formData.displayName || ''} onChange={handleChange}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">A custom label to identify this account clearly on your dashboard.</p>
          </div>
        </div>
      </div>

      {/* 2. Risk Multiplier Mode Selection */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="border-b border-border pb-3 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Risk Multiplier Mode</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose how trade volume is calculated from the master account into this follower terminal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Mode 1: Risk % from Stop Loss */}
          <div 
            onClick={() => handleSelectRiskType('RISK_PERCENT')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              formData.riskType === 'RISK_PERCENT'
                ? 'bg-primary/10 border-primary ring-1 ring-primary/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:border-border/80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-foreground">Risk % from SL</span>
                </div>
                {formData.riskType === 'RISK_PERCENT' && (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Calculates precise lot size so you only risk your designated percentage (e.g. 1%) if Stop Loss is hit, factoring in symbol tick values and multi-currency exchange rates.
              </p>
            </div>
          </div>

          {/* Mode 2: Fixed Lot Size */}
          <div 
            onClick={() => handleSelectRiskType('FIXED_LOT')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              formData.riskType === 'FIXED_LOT'
                ? 'bg-primary/10 border-primary ring-1 ring-primary/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:border-border/80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-foreground">Fixed Lot Size</span>
                </div>
                {formData.riskType === 'FIXED_LOT' && (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Copies every trade with a flat, predefined volume (e.g. exactly 0.05 lots) regardless of the master account&apos;s trade volume or Stop Loss distance.
              </p>
            </div>
          </div>

          {/* Mode 3: Balance Multiplier */}
          <div 
            onClick={() => handleSelectRiskType('BALANCE_MULTIPLIER')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              formData.riskType === 'BALANCE_MULTIPLIER'
                ? 'bg-primary/10 border-primary ring-1 ring-primary/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:border-border/80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Scale className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-foreground">Balance Multiplier</span>
                </div>
                {formData.riskType === 'BALANCE_MULTIPLIER' && (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scales lot size proportionally based on the ratio between this sub account&apos;s balance and the master account&apos;s balance, with an optional multiplier.
              </p>
            </div>
          </div>

          {/* Mode 4: Equity Multiplier */}
          <div 
            onClick={() => handleSelectRiskType('EQUITY_MULTIPLIER')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              formData.riskType === 'EQUITY_MULTIPLIER'
                ? 'bg-primary/10 border-primary ring-1 ring-primary/40 shadow-sm'
                : 'bg-secondary/40 border-border hover:border-border/80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-foreground">Equity Multiplier</span>
                </div>
                {formData.riskType === 'EQUITY_MULTIPLIER' && (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Dynamically adjusts copy lot size based on live floating equity ratios between the accounts, adapting automatically during floating drawdowns or profits.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Fields for Selected Mode */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-border/60">
          {formData.riskType === 'RISK_PERCENT' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Risk Percentage Per Trade (%)</label>
                <input 
                  type="number" step="0.01" min="0.01" max="100.0" name="riskPercentage"
                  value={formData.riskPercentage} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-xs text-muted-foreground">Percentage of your sub account capital risked on Stop Loss (e.g. 1.0 = 1%).</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Rounding Tolerance (%)</label>
                <input 
                  type="number" step="0.1" min="0" name="roundingTolerancePct"
                  value={formData.roundingTolerancePct} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-xs text-muted-foreground">Maximum allowable excess volume % when rounding to broker lot steps.</p>
              </div>
            </div>
          )}

          {formData.riskType === 'FIXED_LOT' && (
            <div className="space-y-2 max-w-sm">
              <label className="text-sm font-semibold">Fixed Volume (Lots)</label>
              <input 
                type="number" step="0.01" min="0.01" max="100.0" name="fixedLotSize"
                value={formData.fixedLotSize} onChange={handleChange}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="text-xs text-muted-foreground">Every incoming trade will copy at exactly this volume (e.g. 0.02).</p>
            </div>
          )}

          {(formData.riskType === 'BALANCE_MULTIPLIER' || formData.riskType === 'EQUITY_MULTIPLIER') && (
            <div className="space-y-2 max-w-sm">
              <label className="text-sm font-semibold">Ratio Multiplier Factor</label>
              <input 
                type="number" step="0.05" min="0.01" max="10.0" name="lotMultiplier"
                value={formData.lotMultiplier} onChange={handleChange}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="text-xs text-muted-foreground">1.0 = exact proportional copy. 0.5 = half risk. 2.0 = double risk.</p>
            </div>
          )}
        </div>

        {/* Advisory */}
        <div className="mt-5 p-4 rounded-xl bg-secondary/40 border border-border/60 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-foreground">Multi-Currency & Symbol Auto-Conversion</h4>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Our risk engine automatically converts currency valuations (e.g. NGN, USD, EUR, GBP) using live interbank exchange rates. When calculating Stop Loss lots on Gold (XAUUSD), Indices, or Forex, the engine normalizes contract specifications and pip values so you never experience unexpected lot sizes.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Safety Limits */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-3">Safety & Drawdown Limits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" id="dailyRiskEnabled" name="dailyRiskEnabled"
                checked={formData.dailyRiskEnabled} onChange={handleChange}
                className="rounded border-border bg-secondary text-primary focus:ring-primary"
              />
              <label htmlFor="dailyRiskEnabled" className="text-sm font-medium">Enable Max Daily Drawdown (Monetary)</label>
            </div>
            {formData.dailyRiskEnabled && (
              <div className="pl-6 space-y-2">
                <input 
                  type="number" step="1" min="0" name="maxDailyRisk"
                  value={formData.maxDailyRisk} onChange={handleChange}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-xs text-muted-foreground">Halt copying immediately if total losses today exceed this monetary amount.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" id="maxTradesEnabled" name="maxTradesEnabled"
                checked={formData.maxTradesEnabled} onChange={handleChange}
                className="rounded border-border bg-secondary text-primary focus:ring-primary"
              />
              <label htmlFor="maxTradesEnabled" className="text-sm font-medium">Enable Max Active Positions</label>
            </div>
            {formData.maxTradesEnabled && (
              <div className="pl-6 space-y-2">
                <input 
                  type="number" step="1" min="1" name="maxActiveTrades"
                  value={formData.maxActiveTrades} onChange={handleChange}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-xs text-muted-foreground">Ignore new signals if this sub account currently has &gt;= this number of open trades.</p>
              </div>
            )}
          </div>
        </div>

        {/* Max Lot Hard Cap Field */}
        <div className="pt-4 border-t border-border/50">
          <div className="max-w-md space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Shield className="w-4 h-4 text-primary" />
                Max Lot Hard Cap (Optional)
              </label>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Absolute Ceiling
              </span>
            </div>
            <input 
              type="number" step="0.01" min="0.01" max="100.0" name="maxLotCap"
              placeholder="e.g. 2.00 (Leave empty for no limit)"
              value={formData.maxLotCap} onChange={handleChange}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Never execute more than this lot size on any trade, regardless of risk percentage, account balance, or master volume.
            </p>
          </div>
        </div>
      </div>

      {/* 4. SL/TP Overrides & Fallbacks */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-3">SL/TP Overrides & Missing SL Handling</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" id="requireTp" name="requireTp"
                checked={formData.requireTp} onChange={handleChange}
                className="rounded border-border bg-secondary text-primary focus:ring-primary"
              />
              <label htmlFor="requireTp" className="text-sm font-medium">Require Take Profit</label>
            </div>
            <p className="text-xs text-muted-foreground pl-6 -mt-2">If enabled, trades opened without a TP will be rejected.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Missing SL Timer / Wait Window (Seconds)</label>
            <input 
              type="number" step="1" min="5" max="300" name="missingSlTimeoutSec"
              value={formData.missingSlTimeoutSec} onChange={handleChange}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              In Risk % mode, trades opened without an SL pause in <span className="font-semibold text-foreground">WAITING_FOR_SL</span>. If Master adds an SL within this window, the trade copies with exact calculated risk. If time expires, the trade is safely skipped.
            </p>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4">
        <button 
          type="submit" 
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Saving...' : 'Save Risk Controls'}
        </button>
        
        {success && <span className="text-sm text-emerald-500 font-medium">Settings saved successfully.</span>}
        {error && <span className="text-sm text-destructive font-medium">{error}</span>}
      </div>
    </form>
  );
}
