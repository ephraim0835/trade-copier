import { Metadata } from 'next';
import { getAdminSupportTickets, getAdminStaffList } from '@/app/actions/support-actions';
import { SupportAdminClient } from './support-admin-client';

export const metadata: Metadata = {
  title: 'Support & Helpdesk Hub | Admin Portal',
};

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
  const [ticketsRes, staffRes] = await Promise.all([
    getAdminSupportTickets({ status: 'ALL' }),
    getAdminStaffList(),
  ]);

  const initialTickets = ticketsRes.success ? (ticketsRes.tickets as any) : [];
  const initialCounts = ticketsRes.counts || {
    all: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    myAssigned: 0,
    unassigned: 0,
  };
  const staffList = staffRes.success ? (staffRes.staff as any) : [];
  const currentAdminId = ticketsRes.currentAdminId || '';

  return (
    <SupportAdminClient
      initialTickets={initialTickets}
      initialCounts={initialCounts}
      staffList={staffList}
      currentAdminId={currentAdminId}
    />
  );
}
