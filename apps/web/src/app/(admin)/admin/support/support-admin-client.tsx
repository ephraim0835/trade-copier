'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  User, 
  Search, 
  RefreshCw, 
  UserCheck, 
  Sparkles, 
  ChevronRight, 
  Mail, 
  Laptop, 
  Zap, 
  Check, 
  Crown,
  Filter,
  CheckCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  sendTicketMessage, 
  updateTicketStatus, 
  updateTicketPriority, 
  assignTicketToAdmin, 
  getAdminSupportTickets 
} from '@/app/actions/support-actions';

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  _count?: {
    assignedSupportTickets: number;
  };
}

interface TicketMessageItem {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
  createdAt: string | Date;
}

interface SupportTicketItem {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  assignedAdminId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    subscription?: {
      planId: string;
      status: string;
    } | null;
    accounts?: Array<{
      id: string;
      role: string;
      broker: string;
    }>;
  };
  assignedAdmin?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  messages: TicketMessageItem[];
}

interface Counts {
  all: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  myAssigned: number;
  unassigned: number;
}

interface SupportAdminClientProps {
  initialTickets: SupportTicketItem[];
  initialCounts: Counts;
  staffList: StaffUser[];
  currentAdminId: string;
}

const CANNED_RESPONSES = [
  "We are reviewing your MT5 bridge logs now. Please allow us a few minutes.",
  "Your symbol mapping settings have been verified and updated successfully.",
  "Your Stop Loss and risk multipliers are configured correctly according to your plan rules.",
  "We noticed your terminal was briefly offline. We have re-synchronized your bridge connection.",
  "This issue has been fully resolved. Please reply to this ticket if you need any further assistance!"
];

export function SupportAdminClient({
  initialTickets,
  initialCounts,
  staffList,
  currentAdminId,
}: SupportAdminClientProps) {
  const [tickets, setTickets] = useState<SupportTicketItem[]>(initialTickets);
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    initialTickets.length > 0 ? initialTickets[0].id : ''
  );
  const [activeTab, setActiveTab] = useState<'ALL' | 'MY' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'UNASSIGNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [replyMessage, setReplyMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Currently selected ticket
  const selectedTicket = useMemo(() => {
    return tickets.find(t => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Refresh data from server
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const res = await getAdminSupportTickets({ status: 'ALL' });
    if (res.success) {
      setTickets(res.tickets as any);
      setCounts(res.counts as any);
    }
    setIsRefreshing(false);
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Tab filter
      if (activeTab === 'MY' && ticket.assignedAdminId !== currentAdminId) return false;
      if (activeTab === 'OPEN' && ticket.status !== 'OPEN') return false;
      if (activeTab === 'IN_PROGRESS' && ticket.status !== 'IN_PROGRESS') return false;
      if (activeTab === 'RESOLVED' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') return false;
      if (activeTab === 'UNASSIGNED' && ticket.assignedAdminId !== null) return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = ticket.subject.toLowerCase().includes(q);
        const matchesEmail = ticket.user.email.toLowerCase().includes(q);
        const matchesName = (ticket.user.name || '').toLowerCase().includes(q);
        const matchesId = ticket.id.toLowerCase().includes(q);
        if (!matchesSubject && !matchesEmail && !matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [tickets, activeTab, priorityFilter, searchQuery, currentAdminId]);

  // Send admin reply
  const handleSendReply = (resolveAfter: boolean = false) => {
    if (!selectedTicket || !replyMessage.trim() || isPending) return;

    const messageText = replyMessage.trim();
    setReplyMessage('');

    startTransition(async () => {
      const res = await sendTicketMessage(selectedTicket.id, messageText);
      if (res.success && res.message) {
        // Optimistically update local message list
        setTickets(prev => prev.map(t => {
          if (t.id === selectedTicket.id) {
            return {
              ...t,
              status: resolveAfter ? 'RESOLVED' : (t.status === 'OPEN' ? 'IN_PROGRESS' : t.status),
              updatedAt: new Date(),
              messages: [...t.messages, res.message as any],
            };
          }
          return t;
        }));

        if (resolveAfter) {
          await updateTicketStatus(selectedTicket.id, 'RESOLVED');
        }

        setActionSuccess(resolveAfter ? 'Reply sent & ticket resolved.' : 'Reply delivered to customer.');
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  // Change ticket status
  const handleStatusChange = (newStatus: string) => {
    if (!selectedTicket || isPending) return;
    startTransition(async () => {
      const res = await updateTicketStatus(selectedTicket.id, newStatus);
      if (res.success) {
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: newStatus, updatedAt: new Date() } : t));
        setActionSuccess(`Status updated to ${newStatus}.`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  // Change ticket priority
  const handlePriorityChange = (newPriority: string) => {
    if (!selectedTicket || isPending) return;
    startTransition(async () => {
      const res = await updateTicketPriority(selectedTicket.id, newPriority);
      if (res.success) {
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, priority: newPriority } : t));
        setActionSuccess(`Priority changed to ${newPriority}.`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  // Reassign ticket to another admin/owner
  const handleAssignAdmin = (adminId: string) => {
    if (!selectedTicket || isPending) return;
    const targetAdminId = adminId === 'unassigned' ? null : adminId;
    const assignedUser = staffList.find(s => s.id === targetAdminId) || null;

    startTransition(async () => {
      const res = await assignTicketToAdmin(selectedTicket.id, targetAdminId);
      if (res.success) {
        setTickets(prev => prev.map(t => {
          if (t.id === selectedTicket.id) {
            return {
              ...t,
              assignedAdminId: targetAdminId,
              assignedAdmin: assignedUser ? { id: assignedUser.id, name: assignedUser.name, email: assignedUser.email } : null,
              updatedAt: new Date()
            };
          }
          return t;
        }));
        setActionSuccess(`Ticket assigned to ${assignedUser ? (assignedUser.name || assignedUser.email) : 'Unassigned'}.`);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <MessageSquare className="w-6 h-6 text-primary" />
              Support & Helpdesk Hub
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Live Operations
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligent ticket dispatching, automatic workload balancing, and live customer resolution.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border/50 text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            Sync Tickets
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setActiveTab('ALL')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'ALL' ? "bg-card border-primary/50 shadow-md ring-1 ring-primary/20" : "bg-card/60 border-border/40 hover:border-border"
          )}
        >
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">Total</span>
          <span className="text-2xl font-mono font-bold text-foreground mt-1 block">{counts.all}</span>
        </div>

        <div 
          onClick={() => setActiveTab('MY')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'MY' ? "bg-card border-primary/50 shadow-md ring-1 ring-primary/20" : "bg-card/60 border-border/40 hover:border-border"
          )}
        >
          <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold block flex items-center gap-1">
            <UserCheck className="w-3 h-3" /> Assigned To Me
          </span>
          <span className="text-2xl font-mono font-bold text-indigo-400 mt-1 block">{counts.myAssigned}</span>
        </div>

        <div 
          onClick={() => setActiveTab('OPEN')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'OPEN' ? "bg-card border-amber-500/50 shadow-md ring-1 ring-amber-500/20" : "bg-card/60 border-border/40 hover:border-border"
          )}
        >
          <span className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold block flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Open / New
          </span>
          <span className="text-2xl font-mono font-bold text-amber-500 mt-1 block">{counts.open}</span>
        </div>

        <div 
          onClick={() => setActiveTab('IN_PROGRESS')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'IN_PROGRESS' ? "bg-card border-sky-500/50 shadow-md ring-1 ring-sky-500/20" : "bg-card/60 border-border/40 hover:border-border"
          )}
        >
          <span className="text-[11px] uppercase tracking-wider text-sky-400 font-semibold block flex items-center gap-1">
            <Clock className="w-3 h-3" /> In Progress
          </span>
          <span className="text-2xl font-mono font-bold text-sky-400 mt-1 block">{counts.inProgress}</span>
        </div>

        <div 
          onClick={() => setActiveTab('RESOLVED')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'RESOLVED' ? "bg-card border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20" : "bg-card/60 border-border/40 hover:border-border"
          )}
        >
          <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
          <span className="text-2xl font-mono font-bold text-emerald-400 mt-1 block">{counts.resolved}</span>
        </div>

        <div 
          onClick={() => setActiveTab('UNASSIGNED')}
          className={cn(
            "p-3.5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'UNASSIGNED' ? "bg-card border-destructive/50 shadow-md ring-1 ring-destructive/20" : "bg-card/60 border-border/40 hover:border-border"
          )}
        >
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">Unassigned</span>
          <span className="text-2xl font-mono font-bold text-foreground mt-1 block">{counts.unassigned}</span>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/50">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by subject, email, customer name, ticket ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-2 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Priority:
          </span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-black/5 dark:bg-white/5 border border-border/30 rounded-xl py-2 px-3 text-xs text-foreground font-semibold focus:outline-none focus:ring-1 ring-primary"
          >
            <option value="ALL">All Priorities</option>
            <option value="VIP">VIP (Elite Tier)</option>
            <option value="PRIORITY">Priority (Pro Tier)</option>
            <option value="STANDARD">Standard</option>
          </select>
        </div>
      </div>

      {actionSuccess && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* MAIN TWO-COLUMN SPLIT DESK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[640px]">
        {/* LEFT COLUMN: TICKET QUEUE */}
        <div className="lg:col-span-5 flex flex-col bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-border/40 bg-black/5 dark:bg-white/[0.02] flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Tickets Queue ({filteredTickets.length})
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              Auto-balancing: Least-loaded active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/20 max-h-[700px]">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold text-foreground">No Tickets Found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? 'Try clearing your search query' : 'No support tickets match the selected filters.'}
                </p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = t.id === selectedTicketId;
                const userPlan = (t.user.subscription?.planId || 'free').toUpperCase();
                const lastMsg = t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={cn(
                      "p-4 transition-all cursor-pointer flex flex-col gap-2 relative",
                      isSelected
                        ? "bg-primary/10 border-l-4 border-l-primary"
                        : "hover:bg-black/5 dark:hover:bg-white/[0.03]"
                    )}
                  >
                    {/* Top Row: User + Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-foreground truncate">
                          {t.user.name || t.user.email}
                        </span>
                        {/* Plan Tier Badge */}
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0",
                          userPlan === 'ELITE' ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                          userPlan === 'PRO' ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30" :
                          "bg-black/10 dark:bg-white/10 text-muted-foreground"
                        )}>
                          {userPlan === 'ELITE' && <Crown className="w-2.5 h-2.5 inline mr-1" />}
                          {userPlan}
                        </span>
                      </div>

                      {/* Status Pill */}
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0",
                        t.status === 'OPEN' && "bg-amber-500/15 text-amber-400 border border-amber-500/25",
                        t.status === 'IN_PROGRESS' && "bg-sky-500/15 text-sky-400 border border-sky-500/25",
                        t.status === 'RESOLVED' && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
                        t.status === 'CLOSED' && "bg-black/10 dark:bg-white/10 text-muted-foreground"
                      )}>
                        {t.status}
                      </span>
                    </div>

                    {/* Subject */}
                    <div className="font-medium text-xs text-foreground line-clamp-1">
                      {t.subject}
                    </div>

                    {/* Snippet of last message */}
                    {lastMsg && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                        {(lastMsg.senderRole === 'ADMIN' || lastMsg.senderRole === 'OWNER') && lastMsg.senderId !== t.userId ? 'Staff: ' : 'User: '}
                        {lastMsg.message}
                      </p>
                    )}

                    {/* Footer Row: Assigned Admin & Time */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/75 pt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {t.assignedAdmin ? (t.assignedAdmin.name || t.assignedAdmin.email) : 'Unassigned'}
                      </span>
                      <span className="font-mono">
                        {new Date(t.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE TICKET DETAIL & CHAT */}
        <div className="lg:col-span-7 flex flex-col bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
          {selectedTicket ? (
            <div className="flex flex-col h-full">
              {/* TICKET TOPBAR */}
              <div className="p-4 border-b border-border/40 bg-black/5 dark:bg-white/[0.02] flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-md">
                      #{selectedTicket.id.slice(0, 8)}
                    </span>
                    <h2 className="font-bold text-sm text-foreground">
                      {selectedTicket.subject}
                    </h2>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Dropdown */}
                    <select
                      value={selectedTicket.status}
                      disabled={isPending}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all focus:outline-none",
                        selectedTicket.status === 'OPEN' && "bg-amber-500/10 border-amber-500/30 text-amber-400",
                        selectedTicket.status === 'IN_PROGRESS' && "bg-sky-500/10 border-sky-500/30 text-sky-400",
                        selectedTicket.status === 'RESOLVED' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                        selectedTicket.status === 'CLOSED' && "bg-black/10 border-border text-muted-foreground"
                      )}
                    >
                      <option value="OPEN">Status: OPEN</option>
                      <option value="IN_PROGRESS">Status: IN PROGRESS</option>
                      <option value="RESOLVED">Status: RESOLVED</option>
                      <option value="CLOSED">Status: CLOSED</option>
                    </select>

                    {/* Priority Dropdown */}
                    <select
                      value={selectedTicket.priority}
                      disabled={isPending}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-black/5 dark:bg-white/5 border border-border/40 text-foreground focus:outline-none"
                    >
                      <option value="STANDARD">Priority: Standard</option>
                      <option value="PRIORITY">Priority: Priority (Pro)</option>
                      <option value="VIP">Priority: VIP (Elite)</option>
                    </select>
                  </div>
                </div>

                {/* Assigned Staff Selector */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Assigned Staff:</span>
                  </div>

                  <select
                    value={selectedTicket.assignedAdminId || 'unassigned'}
                    disabled={isPending}
                    onChange={(e) => handleAssignAdmin(e.target.value)}
                    className="px-3 py-1 rounded-xl text-xs font-medium bg-black/5 dark:bg-white/5 border border-border/40 text-foreground focus:outline-none focus:ring-1 ring-primary"
                  >
                    <option value="unassigned">-- Unassigned --</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name || staff.email} ({staff.role}) {staff._count ? `[${staff._count.assignedSupportTickets} active]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CUSTOMER INFO CARD */}
              <div className="px-4 py-2.5 bg-black/10 dark:bg-white/[0.015] border-b border-border/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{selectedTicket.user.email}</span>
                  {selectedTicket.user.name && (
                    <span className="text-muted-foreground">({selectedTicket.user.name})</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>
                    Plan: <strong className="text-foreground font-mono">{(selectedTicket.user.subscription?.planId || 'free').toUpperCase()}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Accounts: <strong className="text-foreground">{selectedTicket.user.accounts?.length || 0} active</strong>
                  </span>
                </div>
              </div>

              {/* CONVERSATION THREAD */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[460px]">
                {selectedTicket.messages.map((m) => {
                  const isStaff = (m.senderRole === 'ADMIN' || m.senderRole === 'OWNER') && m.senderId !== selectedTicket.user.id;

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-col max-w-[85%] rounded-2xl p-3.5 text-xs",
                        isStaff
                          ? "ml-auto bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                          : "mr-auto bg-black/5 dark:bg-white/5 border border-border/40 text-foreground rounded-tl-none"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-80">
                        <span className="font-bold flex items-center gap-1">
                          {isStaff ? (
                            <>
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              Plaiz Support Staff
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" />
                              {selectedTicket.user.name || selectedTicket.user.email}
                            </>
                          )}
                        </span>
                        <span className="font-mono">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                    </div>
                  );
                })}
              </div>

              {/* QUICK CANNED RESPONSES */}
              <div className="px-4 py-2 border-t border-border/30 bg-black/5 dark:bg-white/[0.01] flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
                <span className="text-muted-foreground font-semibold shrink-0 mr-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Quick Fill:
                </span>
                {CANNED_RESPONSES.map((resp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyMessage(resp)}
                    className="px-2.5 py-1 rounded-lg bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40 shrink-0 transition-all truncate max-w-[220px]"
                    title={resp}
                  >
                    {resp}
                  </button>
                ))}
              </div>

              {/* REPLY INPUT AREA */}
              <div className="p-4 border-t border-border/40 bg-card flex flex-col gap-2.5">
                <textarea
                  rows={3}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type an official reply to the trader..."
                  className="w-full bg-black/5 dark:bg-white/5 border border-border/40 rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 ring-primary/20 transition-all resize-none"
                />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-muted-foreground">
                    Sending will automatically notify the customer and update ticket status.
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!replyMessage.trim() || isPending}
                      onClick={() => handleSendReply(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Send & Resolve
                    </button>

                    <button
                      type="button"
                      disabled={!replyMessage.trim() || isPending}
                      onClick={() => handleSendReply(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-bold text-foreground">Select a Support Ticket</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Choose a ticket from the queue on the left to inspect customer details, reply to inquiries, or reassign workload.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
