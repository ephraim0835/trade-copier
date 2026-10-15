'use client';

import { useState } from 'react';
import { 
  Percent, Plus, Trash2, Power, Copy, Check, Calendar, 
  Clock, ShieldAlert, Users, AlertTriangle, ArrowRight, X 
} from 'lucide-react';
import { 
  createDiscountCode, 
  toggleDiscountCodeActive, 
  deleteDiscountCode,
  scheduleLifetimeDiscountRemoval,
  cancelLifetimeDiscountRemoval 
} from '@/app/actions/discount-actions';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function DiscountsClient({ 
  codes, 
  discountedUsers 
}: { 
  codes: any[]; 
  discountedUsers: any[]; 
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'CODES' | 'USERS'>('CODES');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Form states
  const [codeName, setCodeName] = useState('');
  const [percentage, setPercentage] = useState('20');
  const [duration, setDuration] = useState<'FIRST_MONTH' | 'LIFETIME'>('FIRST_MONTH');
  const [validUntil, setValidUntil] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm Removal Modal
  const [scheduledTargetSub, setScheduledTargetSub] = useState<any>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const res = await createDiscountCode({
      code: codeName,
      percentage: Number(percentage),
      duration,
      validUntil: validUntil || undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setIsCreateModalOpen(false);
      setCodeName('');
      setPercentage('20');
      setDuration('FIRST_MONTH');
      setValidUntil('');
      setMaxUses('');
      router.refresh();
    } else {
      setFormError(res.error || 'Failed to create discount code');
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setLoadingAction(id);
    await toggleDiscountCodeActive(id, !currentStatus);
    setLoadingAction(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this discount code?')) return;
    setLoadingAction(id);
    await deleteDiscountCode(id);
    setLoadingAction(null);
    router.refresh();
  };

  const handleScheduleRemoval = async (subId: string) => {
    setLoadingAction(subId);
    await scheduleLifetimeDiscountRemoval(subId);
    setLoadingAction(null);
    setScheduledTargetSub(null);
    router.refresh();
  };

  const handleCancelRemoval = async (subId: string) => {
    setLoadingAction(subId);
    await cancelLifetimeDiscountRemoval(subId);
    setLoadingAction(null);
    router.refresh();
  };

  const activeCodesCount = codes.filter(c => c.isActive).length;
  const lifetimeCodesCount = codes.filter(c => c.duration === 'LIFETIME').length;
  const pendingRemovalUsers = discountedUsers.filter(u => u.lifetimeDiscountScheduledRemovalAt);

  return (
    <div className="flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Promotions & Discount Codes</h1>
          <p className="text-muted-foreground">Manage first-month and lifetime discount codes, redemption limits, and 14-day notice removals.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 w-fit"
        >
          <Plus className="w-4 h-4" />
          Create Discount Code
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="plaiz-card p-5 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5" /> Active Codes
          </span>
          <span className="text-2xl font-bold text-foreground num-tabular mt-1">{activeCodesCount}</span>
          <span className="text-xs text-muted-foreground">Out of {codes.length} total codes</span>
        </div>

        <div className="plaiz-card p-5 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Lifetime Codes
          </span>
          <span className="text-2xl font-bold text-foreground num-tabular mt-1">{lifetimeCodesCount}</span>
          <span className="text-xs text-muted-foreground">Recurring discounts</span>
        </div>

        <div className="plaiz-card p-5 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Active Subscriptions
          </span>
          <span className="text-2xl font-bold text-foreground num-tabular mt-1">{discountedUsers.length}</span>
          <span className="text-xs text-muted-foreground">Users with discounts applied</span>
        </div>

        <div className="plaiz-card p-5 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Pending Removals
          </span>
          <span className="text-2xl font-bold text-amber-500 num-tabular mt-1">{pendingRemovalUsers.length}</span>
          <span className="text-xs text-muted-foreground">In 14-day notice period</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/40 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('CODES')}
          className={cn(
            "pb-3 flex items-center gap-2 border-b-2 transition-all",
            activeTab === 'CODES' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Percent className="w-4 h-4" />
          Discount Codes ({codes.length})
        </button>
        <button
          onClick={() => setActiveTab('USERS')}
          className={cn(
            "pb-3 flex items-center gap-2 border-b-2 transition-all",
            activeTab === 'USERS' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-4 h-4" />
          Users with Lifetime Discounts ({discountedUsers.length})
        </button>
      </div>

      {/* TAB 1: CODES TABLE */}
      {activeTab === 'CODES' && (
        <div className="plaiz-card rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-black/5 dark:bg-white/5 border-b border-border/40">
                <tr>
                  <th className="px-6 py-4 font-semibold">Code</th>
                  <th className="px-6 py-4 font-semibold">Discount</th>
                  <th className="px-6 py-4 font-semibold">Duration</th>
                  <th className="px-6 py-4 font-semibold">Validity / Expiry</th>
                  <th className="px-6 py-4 font-semibold">Redemptions</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      <Percent className="w-8 h-8 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No discount codes created yet.</p>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="mt-3 text-xs text-primary font-semibold underline"
                      >
                        Create your first code
                      </button>
                    </td>
                  </tr>
                ) : (
                  codes.map((code) => {
                    const isExpired = code.validUntil && new Date(code.validUntil).getTime() < Date.now();
                    const isLimitReached = code.maxUses && code.usedCount >= code.maxUses;

                    return (
                      <tr key={code.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground text-sm tracking-wider bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-border/30">
                              {code.code}
                            </span>
                            <button
                              onClick={() => handleCopy(code.code)}
                              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === code.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-6 py-4 font-bold text-primary num-tabular">
                          {code.percentage}% OFF
                        </td>

                        <td className="px-6 py-4">
                          {code.duration === 'LIFETIME' ? (
                            <span className="plaiz-pill bg-purple-500/10 text-purple-500 border-purple-500/20 text-xs font-semibold">
                              Lifetime Recurring
                            </span>
                          ) : (
                            <span className="plaiz-pill plaiz-pill-neutral text-xs font-semibold">
                              1st Month Only
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {code.validUntil ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className={isExpired ? "text-destructive font-medium" : "text-muted-foreground"}>
                                {new Date(code.validUntil).toLocaleDateString()}
                                {isExpired && ' (Expired)'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Ongoing (No expiration)</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs font-mono num-tabular">
                          {code.usedCount} {code.maxUses ? `/ ${code.maxUses}` : 'used'}
                          {isLimitReached && <span className="text-destructive ml-1">(Maxed)</span>}
                        </td>

                        <td className="px-6 py-4">
                          {code.isActive && !isExpired && !isLimitReached ? (
                            <span className="plaiz-pill plaiz-pill-success text-xs">Active</span>
                          ) : (
                            <span className="plaiz-pill plaiz-pill-neutral text-xs">Inactive</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggle(code.id, code.isActive)}
                              disabled={loadingAction === code.id}
                              className={cn(
                                "p-2 rounded-lg text-xs font-medium transition-colors",
                                code.isActive 
                                  ? "text-amber-500 hover:bg-amber-500/10" 
                                  : "text-emerald-500 hover:bg-emerald-500/10"
                              )}
                              title={code.isActive ? "Deactivate Code" : "Activate Code"}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(code.id)}
                              disabled={loadingAction === code.id}
                              className="p-2 rounded-lg text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
                              title="Delete Code"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: USERS WITH DISCOUNTS & 14-DAY NOTICE REMOVAL */}
      {activeTab === 'USERS' && (
        <div className="plaiz-card rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-black/5 dark:bg-white/5 border-b border-border/40">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Discount Applied</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Removal Notice Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {discountedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
                      <p>No active users with discount codes found.</p>
                    </td>
                  </tr>
                ) : (
                  discountedUsers.map((sub) => {
                    const hasRemovalScheduled = !!sub.lifetimeDiscountScheduledRemovalAt;
                    const removalDate = hasRemovalScheduled ? new Date(sub.lifetimeDiscountScheduledRemovalAt) : null;
                    const daysRemaining = removalDate 
                      ? Math.max(0, Math.ceil((removalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                      : null;

                    return (
                      <tr key={sub.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{sub.user.email}</span>
                            <span className="text-[10px] text-muted-foreground">User ID: {sub.userId.slice(0, 8)}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded border border-border/30">
                              {sub.discountCode?.code || 'CUSTOM'}
                            </span>
                            <span className="font-semibold text-primary">{sub.discountCode?.percentage || 0}% OFF</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {sub.discountCode?.duration === 'LIFETIME' ? (
                            <span className="plaiz-pill bg-purple-500/10 text-purple-500 border-purple-500/20 text-xs font-semibold">
                              Lifetime Discount
                            </span>
                          ) : (
                            <span className="plaiz-pill plaiz-pill-neutral text-xs">
                              1 Month Only
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {hasRemovalScheduled ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-amber-500 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                14-Day Notice Active ({daysRemaining} days left)
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Removes on: {removalDate?.toLocaleDateString()} (7-day reminder scheduled)
                              </span>
                            </div>
                          ) : (
                            <span className="text-emerald-500 font-medium flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Active & Guaranteed
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {sub.discountCode?.duration === 'LIFETIME' && (
                            hasRemovalScheduled ? (
                              <button
                                onClick={() => handleCancelRemoval(sub.id)}
                                disabled={loadingAction === sub.id}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-semibold text-xs transition-colors"
                              >
                                Cancel Removal
                              </button>
                            ) : (
                              <button
                                onClick={() => setScheduledTargetSub(sub)}
                                disabled={loadingAction === sub.id}
                                className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 font-semibold text-xs transition-colors"
                              >
                                Schedule Removal (14-Day Notice)
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE DISCOUNT CODE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md plaiz-card bg-card rounded-[28px] overflow-hidden shadow-2xl border border-border/30 p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Create Discount Code</h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER50, VIPPROMO"
                  value={codeName}
                  onChange={(e) => setCodeName(e.target.value.toUpperCase())}
                  className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-2.5 px-4 text-sm font-mono uppercase text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount %</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-2.5 px-4 text-sm font-bold text-foreground focus:outline-none focus:ring-2 ring-primary/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">%</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max Uses</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 ring-primary/20"
                  />
                </div>
              </div>

              {/* Duration Choice */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount Duration</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDuration('FIRST_MONTH')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 transition-all",
                      duration === 'FIRST_MONTH' 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "border-border/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>1st Month Only</span>
                    <span className="text-[10px] font-normal opacity-75">(Standard promo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuration('LIFETIME')}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 transition-all",
                      duration === 'LIFETIME' 
                        ? "bg-purple-500/10 border-purple-500 text-purple-500" 
                        : "border-border/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>Lifetime Recurring</span>
                    <span className="text-[10px] font-normal opacity-75">(VIP / Special)</span>
                  </button>
                </div>
              </div>

              {/* Optional Expiration Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-2 ring-primary/20"
                />
                <span className="text-[10px] text-muted-foreground">Leave empty if code should never expire.</span>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border/40 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM 14-DAY NOTICE REMOVAL MODAL */}
      {scheduledTargetSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md plaiz-card bg-card rounded-[28px] overflow-hidden shadow-2xl border border-border/30 p-6 flex flex-col gap-5">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-lg text-foreground">Schedule Lifetime Discount Removal</h3>
              <p className="text-xs text-muted-foreground mt-1">
                For subscriber: <strong className="text-foreground">{scheduledTargetSub.user.email}</strong>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border/20 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>14-Day Mandatory Notice Window</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                By initiating this removal, the system will immediately notify the user. They will be granted a <strong>14-day reaction period</strong> before the discount terminates. A reminder notification will also be dispatched <strong>7 days prior</strong> to removal.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setScheduledTargetSub(null)}
                className="px-4 py-2.5 rounded-xl border border-border/40 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleScheduleRemoval(scheduledTargetSub.id)}
                disabled={loadingAction === scheduledTargetSub.id}
                className="px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-all shadow-md shadow-destructive/20 disabled:opacity-50"
              >
                {loadingAction === scheduledTargetSub.id ? 'Scheduling...' : 'Confirm & Send 14-Day Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
