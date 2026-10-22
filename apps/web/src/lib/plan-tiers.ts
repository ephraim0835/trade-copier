export const PLAN_TIER_RANKS: Record<string, number> = {
  starter: 1,
  basic: 1,
  pro: 2,
  elite: 3,
};

export type PlanActionType = 'SELECT' | 'RENEW' | 'DOWNGRADE' | 'UPGRADE';

/**
 * Determines whether a target plan represents an upgrade, downgrade, renewal, or initial selection.
 */
export function getPlanActionType(
  targetPlanId: string,
  currentPlanId: string | null | undefined,
  status: string | null | undefined
): PlanActionType {
  if (status !== 'ACTIVE' && status !== 'INTERNAL_FREE') {
    return 'SELECT';
  }

  const currentKey = (currentPlanId || '').toLowerCase();
  const targetKey = (targetPlanId || 'starter').toLowerCase();
  const currentRank = PLAN_TIER_RANKS[currentKey] || 0;
  const targetRank = PLAN_TIER_RANKS[targetKey] || 0;

  if (currentRank > 0 && targetRank === currentRank) {
    return 'RENEW';
  }

  if (currentRank > 0 && targetRank < currentRank) {
    return 'DOWNGRADE';
  }

  return 'UPGRADE';
}

/**
 * Returns the contextual action label for a plan tier based on the user's current subscription.
 * - Active plan equal to target: "Renew {Plan}"
 * - Target tier below active plan: "Downgrade to {Plan}"
 * - Target tier above active plan: "Upgrade to {Plan}"
 * - Trial / Expired / Unsubscribed: "Select {Plan}"
 */
export function getPlanActionLabel(
  targetPlanId: string,
  currentPlanId: string | null | undefined,
  status: string | null | undefined
): string {
  const targetKey = (targetPlanId || 'starter').toLowerCase();
  const targetName = targetKey === 'elite' ? 'Elite' : targetKey === 'pro' ? 'Pro' : 'Starter';
  const actionType = getPlanActionType(targetPlanId, currentPlanId, status);

  switch (actionType) {
    case 'RENEW':
      return `Renew ${targetName}`;
    case 'DOWNGRADE':
      return `Downgrade to ${targetName}`;
    case 'UPGRADE':
      return `Upgrade to ${targetName}`;
    case 'SELECT':
    default:
      return `Select ${targetName}`;
  }
}
