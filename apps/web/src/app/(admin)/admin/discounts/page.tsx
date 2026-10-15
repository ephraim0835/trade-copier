import { getDiscountCodes, getUsersWithDiscounts } from '@/app/actions/discount-actions';
import { DiscountsClient } from './discounts-client';

export const dynamic = 'force-dynamic';

export default async function AdminDiscountsPage() {
  const [codesRes, usersRes] = await Promise.all([
    getDiscountCodes(),
    getUsersWithDiscounts(),
  ]);

  const codes = codesRes.success ? (codesRes.codes || []) : [];
  const discountedUsers = usersRes.success ? (usersRes.subscriptions || []) : [];

  return <DiscountsClient codes={codes} discountedUsers={discountedUsers} />;
}
