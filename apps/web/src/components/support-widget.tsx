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
  ExternalLink
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

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await getUserSupportTickets();
      if (res.success && res.tickets) {
        setTickets(res.tickets);
        // If viewing an active ticket, refresh its messages
        if (activeTicket) {
          const updated = res.tickets.find((t: any) => t.id === activeTicket.id);
          if (updated) setActiveTicket(updated);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined') {
        document.body.classList.add('support-widget-open');
      }
      fetchTickets();
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
    if (!replyText.trim() || !activeTicket) return;

    setSendingReply(true);
    try {
      const res = await sendTicketMessage(activeTicket.id, replyText.trim());
      if (res.success && res.message) {
        setActiveTicket((prev: any) => ({
          ...prev,
          messages: [...(prev.messages || []), res.message],
        }));
        setReplyText('');
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
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
                <div className="p-3.5 border-b border-border/30 flex items-center justify-between bg-black/5 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveTicket(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="text-right">
                    <span className="text-[11px] font-bold text-foreground block truncate max-w-[200px]">
                      {activeTicket.subject}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      activeTicket.status === 'RESOLVED' ? 'text-emerald-500' : 'text-primary'
                    }`}>
                      {activeTicket.status} • {activeTicket.priority}
                    </span>
                  </div>
                </div>

                {/* Messages Thread */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                  {activeTicket.messages?.map((msg: any) => {
                    const isUser = msg.senderRole === 'USER' || msg.senderId === activeTicket.userId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {isUser ? 'You' : (activeTicket.assignedAdmin?.name || 'Plaiz Support')}
                          </span>
                          <span className="text-[9px] text-muted-foreground/70">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                            isUser
                              ? 'bg-primary text-primary-foreground rounded-tr-xs'
                              : 'bg-secondary text-foreground border border-border/50 rounded-tl-xs'
                          }`}
                        >
                          {msg.message}
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
