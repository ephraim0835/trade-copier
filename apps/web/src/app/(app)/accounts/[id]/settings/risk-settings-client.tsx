'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2 } from 'lucide-react';

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
    riskMultiplier: initialSettings.riskMultiplier?.toString() || '1.0',
    roundingTolerancePct: initialSettings.roundingTolerancePct?.toString() || '2.0',
    dailyRiskEnabled: initialSettings.dailyRiskEnabled || false,
    maxDailyRisk: initialSettings.maxDailyRisk?.toString() || '0',
    maxTradesEnabled: initialSettings.maxTradesEnabled || false,
    maxActiveTrades: initialSettings.maxActiveTrades?.toString() || '0',
    requireTp: initialSettings.requireTp || false,
    missingSlTimeoutSec: initialSettings.missingSlTimeoutSec?.toString() || '60',
    maxRecoveryRRDegradation: initialSettings.maxRecoveryRRDegradation?.toString() || '0.5',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    let parsedValue: any = value;
    if (type === 'checkbox') parsedValue = checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
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
        riskMultiplier: Number(formData.riskMultiplier),
        roundingTolerancePct: Number(formData.roundingTolerancePct),
        dailyRiskEnabled: formData.dailyRiskEnabled,
        maxDailyRisk: Number(formData.maxDailyRisk),
        maxTradesEnabled: formData.maxTradesEnabled,
        maxActiveTrades: Number(formData.maxActiveTrades),
        requireTp: formData.requireTp,
        missingSlTimeoutSec: Number(formData.missingSlTimeoutSec),
        maxRecoveryRRDegradation: Number(formData.maxRecoveryRRDegradation),
      };

      // Call the Next.js API proxy
      const res = await fetch(`/api/accounts/${accountId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        const errorMessage = Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'Failed to save settings');
        throw new Error(errorMessage);
      }

      setSuccess(true);
      // Auto-hide success message after 3 seconds
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
        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-3">Account Details</h2>
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name (Optional)</label>
            <input 
              type="text" name="displayName" placeholder="e.g. My Sub Account"
              value={formData.displayName || ''} onChange={handleChange}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">A custom name to show on the dashboard instead of the account login.</p>
          </div>
        </div>
      </div>

      {/* 2. Core Risk Engine */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-3">Core Risk Engine</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Risk Multiplier (x)</label>
            <input 
              type="number" step="0.01" min="0.01" max="10.0" name="riskMultiplier"
              value={formData.riskMultiplier} onChange={handleChange}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">Master trade volume is multiplied by this value.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rounding Tolerance (%)</label>
            <input 
              type="number" step="0.1" min="0" name="roundingTolerancePct"
              value={formData.roundingTolerancePct} onChange={handleChange}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">Max allowed excess volume % when rounding MT5 lots.</p>
          </div>
        </div>
      </div>

      {/* 2. Trade Limits */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-3">Safety Limits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" id="dailyRiskEnabled" name="dailyRiskEnabled"
                checked={formData.dailyRiskEnabled} onChange={handleChange}
                className="rounded border-border bg-secondary text-primary focus:ring-primary"
              />
              <label htmlFor="dailyRiskEnabled" className="text-sm font-medium">Enable Max Daily Risk (Monetary)</label>
            </div>
            {formData.dailyRiskEnabled && (
              <div className="pl-6 space-y-2">
                <input 
                  type="number" step="1" min="0" name="maxDailyRisk"
                  value={formData.maxDailyRisk} onChange={handleChange}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">Stop copying if daily loss exceeds this amount.</p>
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
              <label htmlFor="maxTradesEnabled" className="text-sm font-medium">Enable Max Active Trades</label>
            </div>
            {formData.maxTradesEnabled && (
              <div className="pl-6 space-y-2">
                <input 
                  type="number" step="1" min="1" name="maxActiveTrades"
                  value={formData.maxActiveTrades} onChange={handleChange}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">Reject signals if open trades &gt;= this value.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Safety Fallbacks */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 border-b border-border pb-3">SL/TP Overrides & Fallbacks</h2>
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
            <p className="text-xs text-muted-foreground pl-6 -mt-2">If enabled, trades missing a TP will be rejected.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Missing SL Timeout (Seconds)</label>
            <input 
              type="number" step="1" min="1" name="missingSlTimeoutSec"
              value={formData.missingSlTimeoutSec} onChange={handleChange}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">Auto-close trades if Master doesn't set an SL within this time.</p>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-4">
        <button 
          type="submit" 
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
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
