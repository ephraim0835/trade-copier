'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Loader2, 
  MessageCircle, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ChevronRight, 
  ArrowLeft, 
  ShieldCheck,
  ExternalLink,
  Check,
  CheckCheck
} from 'lucide-react';
import { 
  getUserSupportTickets, 
  createSupportTicket, 
  sendTicketMessage, 
  closeSupportTicket 
} from '@/app/actions/support-actions';

interface SupportWidgetProps {
  // Default WhatsApp link - user can change or provide their own
  whatsappUrl?: string;
}

export function SupportWidget({
  whatsappUrl = 'https://chat.whatsapp.com/HSUiI1t5ECq5Sw51kz7Joi',
}: SupportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'new'>('tickets');
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('TECHNICAL');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeTicketIdRef = useRef<string | null>(null);

  // Play subtle WhatsApp-style pop chime on incoming messages
  const playWhatsAppPop = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignore audio restriction
    }
  };

  const fetchTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getUserSupportTickets();
      if (res.success && res.tickets) {
        setTickets(res.tickets);
        // If viewing an active ticket, refresh its messages
        if (activeTicketIdRef.current) {
          const updated = res.tickets.find((t: any) => t.id === activeTicketIdRef.current);
          if (updated) {
            setActiveTicket((prev: any) => {
              if (!prev) return updated;
              const prevMsgCount = prev.messages?.length || 0;
              const newMsgCount = updated.messages?.length || 0;
              if (newMsgCount > prevMsgCount) {
                const last = updated.messages[newMsgCount - 1];
                if (last && last.senderRole === 'ADMIN') {
                  playWhatsAppPop();
                }
              }
              return updated;
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Keep activeTicketIdRef in sync
  useEffect(() => {
    activeTicketIdRef.current = activeTicket?.id || null;
  }, [activeTicket?.id]);

  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined') {
        document.body.classList.add('support-widget-open');
      }
      fetchTickets();
      // Poll tickets list every 6 seconds when widget is open
      const listPoll = setInterval(() => {
        if (!activeTicketIdRef.current) {
          fetchTickets(true);
        }
      }, 6000);
      return () => clearInterval(listPoll);
    } else {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('support-widget-open');
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('support-widget-open');
      }
    };
  }, [isOpen]);

  // Real-time instant WhatsApp-like polling (1.5s interval) for active ticket
  useEffect(() => {
    if (!isOpen || !activeTicket?.id) return;

    let isMounted = true;
    const pollActiveTicket = async () => {
      try {
        const res = await fetch(`/api/support/ticket-messages?ticketId=${activeTicket.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.messages && isMounted) {
          setActiveTicket((prev: any) => {
            if (!prev || prev.id !== activeTicket.id) return prev;
            const prevCount = (prev.messages || []).length;
            const newCount = data.messages.length;
            if (newCount > prevCount) {
              const lastMsg = data.messages[newCount - 1];
              if (lastMsg && lastMsg.senderRole === 'ADMIN') {
                playWhatsAppPop();
              }
            }
            return {
              ...prev,
              status: data.status || prev.status,
              priority: data.priority || prev.priority,
              assignedAdmin: data.assignedAdmin || prev.assignedAdmin,
              messages: data.messages,
            };
          });
        }
      } catch {
        // Silent fail
      }
    };

    const interval = setInterval(pollActiveTicket, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, activeTicket?.id]);

  useEffect(() => {
    if (activeTicket && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTicket?.messages]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorMsg('Please enter both subject and message.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createSupportTicket({
        subject: subject.trim(),
        category,
        message: message.trim(),
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to submit ticket.');
      }

      setSubject('');
      setMessage('');
      setSuccessMsg('Ticket submitted successfully! Our support desk will reply promptly.');
      setTimeout(() => setSuccessMsg(null), 4000);
      
      await fetchTickets();
      setActiveTab('tickets');
      if (res.ticket) {
        setActiveTicket(res.ticket);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || !activeTicket) return;

    // 1. WhatsApp-style instant optimistic message injection
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      ticketId: activeTicket.id,
      senderId: 'me',
      senderRole: 'USER',
      message: text,
      createdAt: new Date().toISOString(),
      isPending: true,
    };

    setActiveTicket((prev: any) => ({
      ...prev,
      messages: [...(prev?.messages || []), optimisticMessage],
    }));
    setReplyText('');
    setSendingReply(true);

    try {
      const res = await fetch('/api/support/ticket-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          message: text,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setActiveTicket((prev: any) => {
          if (!prev) return prev;
          const filtered = (prev.messages || []).filter((m: any) => m.id !== tempId);
          return {
            ...prev,
            messages: [...filtered, data.message],
          };
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <>
      {/* Floating Support Button */}
      <aside aria-label="Support Desk" className="fixed bottom-24 lg:bottom-6 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-xl shadow-primary/25 hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
        >
          <MessageSquare className="w-4 h-4 fill-current" />
          <span className="hidden sm:inline">Support & Community</span>
          <span className="sm:hidden">Support</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </aside>

      {/* Support Drawer / Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 flex items-end sm:items-center justify-end sm:justify-end sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          style={{ zIndex: 99999 }}
        >
          <div 
            className="bg-card border border-border/80 w-full sm:w-[440px] h-[86dvh] sm:h-[660px] max-h-[88dvh] sm:max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden relative animate-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-200"
            style={{ zIndex: 100000 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-4 border-b border-border/40 flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    Plaiz Support Desk
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  </h3>
                  <p className="text-[11px] text-muted-foreground">In-app tickets & trader community</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setActiveTicket(null);
                }}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Official WhatsApp Community Banner - Always Visible at Top */}
            <div className="p-3.5 mx-4 mt-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <MessageCircle className="w-4 h-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-foreground block truncate">
                    Official WhatsApp Support
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    Join our trader community & direct desk
                  </span>
                </div>
              </div>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm shadow-emerald-500/20"
              >
                <span>Join</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Content Area */}
            {activeTicket ? (
              /* Ticket Chat View */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Chat Top Bar */}
                <div className="p-3 border-b border-border/30 flex items-center justify-between bg-black/5 dark:bg-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setActiveTicket(null)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0 relative">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-card" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground truncate block">
                          Plaiz Support Desk
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                          Online
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {activeTicket.subject}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                    activeTicket.status === 'RESOLVED' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {activeTicket.status}
                  </span>
                </div>

                {/* Messages Thread */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 bg-black/[0.02] dark:bg-white/[0.01]">
                  {activeTicket.messages?.map((msg: any) => {
                    const isUser = msg.senderRole === 'USER' || msg.senderId === activeTicket.userId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        {!isUser && (
                          <span className="text-[10px] font-bold text-muted-foreground px-1 mb-0.5 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-primary" />
                            {activeTicket.assignedAdmin?.name || 'Plaiz Support Agent'}
                          </span>
                        )}
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap flex flex-col gap-1 shadow-xs ${
                            isUser
                              ? 'bg-primary text-primary-foreground rounded-tr-xs'
                              : 'bg-card text-foreground border border-border/50 rounded-tl-xs'
                          }`}
                        >
                          <p className="select-text">{msg.message}</p>
                          <div className={`flex items-center justify-end gap-1 text-[9px] select-none self-end ${
                            isUser ? 'text-primary-foreground/75' : 'text-muted-foreground'
                          }`}>
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isUser && (
                              msg.isPending ? (
                                <Clock className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Input */}
                <form 
                  onSubmit={handleSendReply} 
                  className="p-3 sm:p-3.5 border-t border-border/40 bg-card flex items-center gap-2 shrink-0 z-20"
                  style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 bg-background border border-border/50 rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 shrink-0 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {sendingReply ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Tickets List & New Ticket Tab */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Tabs Switcher */}
                <div className="p-3 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-border/30">
                    <button
                      type="button"
                      onClick={() => setActiveTab('tickets')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'tickets'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      My Tickets ({tickets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('new')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'new'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      New Ticket
                    </button>
                  </div>

                  <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    Avg reply: &lt;15m
                  </span>
                </div>

                {/* Tab: Tickets List */}
                {activeTab === 'tickets' ? (
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2.5">
                    {loading ? (
                      <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-xs">Loading support tickets...</span>
                      </div>
                    ) : tickets.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-xs font-bold text-foreground">No Support Tickets Yet</p>
                        <p className="text-[11px] mt-1 max-w-xs">
                          Need help with a broker connection, risk sizing, or subscription? Open a new ticket anytime.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('new')}
                          className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Ticket</span>
                        </button>
                      </div>
                    ) : (
                      tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          onClick={() => setActiveTicket(ticket)}
                          className="p-3.5 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                ticket.status === 'RESOLVED'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : ticket.status === 'IN_PROGRESS'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-amber-500/10 text-amber-500'
                              }`}>
                                {ticket.status}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                {ticket.category}
                              </span>
                              {ticket.priority !== 'STANDARD' && (
                                <span className="px-1.5 py-0.2 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-bold rounded">
                                  {ticket.priority}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-foreground truncate">
                              {ticket.subject}
                            </h4>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {ticket.messages?.[ticket.messages.length - 1]?.message || 'No messages yet'}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* Tab: New Ticket Form */
                  <form onSubmit={handleCreateTicket} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3.5">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Category
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="TECHNICAL">Technical / MT5 Connection</option>
                          <option value="RISK_ENGINE">Lotsize & Risk Engine</option>
                          <option value="BROKER">Broker / Prop Firm Compatibility</option>
                          <option value="BILLING">Billing & Subscriptions</option>
                          <option value="GENERAL">General Inquiry</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Subject
                        </label>
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="e.g. Question about lot size calculation on XAUUSD"
                          className="w-full bg-background border border-border/50 rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="flex-1 flex flex-col min-h-[110px]">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Message Details
                        </label>
                        <textarea
                          rows={4}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Describe your issue or question in detail..."
                          className="flex-1 min-h-[110px] bg-background border border-border/50 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                      </div>

                      {errorMsg && (
                        <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-[11px] font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      {successMsg && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-[11px] font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{successMsg}</span>
                        </div>
                      )}
                    </div>

                    {/* Fixed / Pinned Submit Action Footer */}
                    <div 
                      className="p-3 sm:p-4 border-t border-border/40 bg-card shrink-0 z-20"
                      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}
                    >
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20 shrink-0 cursor-pointer"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Submit Support Ticket</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
