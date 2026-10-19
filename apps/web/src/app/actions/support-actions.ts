'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { formatUserFriendlyError } from '@/lib/error-formatter';

// ==========================================
// USER SUPPORT ACTIONS
// ==========================================

export async function getUserSupportTickets() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized', tickets: [] };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, subscription: true },
    });

    if (!user) {
      return { success: false, error: 'User not found', tickets: [] };
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { userId: user.id },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return { success: true, tickets };
  } catch (err: any) {
    console.error('Error fetching support tickets:', err);
    return { success: false, error: formatUserFriendlyError(err), tickets: [] };
  }
}

export async function createSupportTicket(data: {
  subject: string;
  category: string;
  message: string;
  priority?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { subscription: true },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!data.subject?.trim() || !data.message?.trim()) {
      return { success: false, error: 'Subject and message are required.' };
    }

    // Auto-escalate priority for Pro and Elite users
    const userPlan = (user.subscription?.planId || '').toLowerCase();
    let priority = data.priority || 'STANDARD';
    if (userPlan === 'elite') {
      priority = 'VIP';
    } else if (userPlan === 'pro') {
      priority = 'PRIORITY';
    }

    // Least-loaded intelligent assignment algorithm:
    // Query active admins/owners and pick the one with fewest active (OPEN / IN_PROGRESS) tickets
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'OWNER'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            assignedSupportTickets: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
    });

    let assignedAdminId: string | null = null;
    if (admins.length > 0) {
      // Sort ascending by active ticket count
      admins.sort((a, b) => a._count.assignedSupportTickets - b._count.assignedSupportTickets);
      assignedAdminId = admins[0].id;
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: data.subject.trim(),
        category: data.category || 'GENERAL',
        priority,
        status: 'OPEN',
        assignedAdminId,
        messages: {
          create: {
            senderId: user.id,
            senderRole: user.role === 'ADMIN' || user.role === 'OWNER' ? 'ADMIN' : 'USER',
            message: data.message.trim(),
          },
        },
      },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true },
        },
        messages: true,
      },
    });

    // Notify assigned admin if found
    if (assignedAdminId) {
      await prisma.userNotification.create({
        data: {
          userId: assignedAdminId,
          title: `New Support Ticket: ${ticket.subject}`,
          message: `${user.name || user.email} opened a ${priority} ticket. You have been assigned.`,
          type: priority === 'VIP' ? 'ALERT' : 'INFO',
          actionUrl: `/admin/support?ticketId=${ticket.id}`,
        },
      }).catch(err => console.error('Failed to notify admin:', err));
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin/support');
    return { success: true, ticket };
  } catch (err: any) {
    console.error('Error creating support ticket:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function sendTicketMessage(ticketId: string, message: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!message?.trim()) {
      return { success: false, error: 'Message cannot be empty.' };
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true, assignedAdmin: true },
    });

    if (!ticket) {
      return { success: false, error: 'Ticket not found.' };
    }

    const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';
    if (ticket.userId !== user.id && !isAdmin) {
      return { success: false, error: 'Access denied.' };
    }

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: user.id,
        senderRole: isAdmin ? 'ADMIN' : 'USER',
        message: message.trim(),
      },
    });

    // If an admin replied, mark as IN_PROGRESS if OPEN, and notify customer
    if (isAdmin) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
          updatedAt: new Date(),
        },
      });

      // Notify customer of support response
      await prisma.userNotification.create({
        data: {
          userId: ticket.userId,
          title: `Support Agent Replied`,
          message: `Your ticket "${ticket.subject}" received a response from Plaiz Support.`,
          type: 'INFO',
          actionUrl: `/dashboard`,
        },
      }).catch(err => console.error('Failed to notify customer:', err));
    } else {
      // Customer sent a message: reopen if resolved/closed, and update timestamp
      const newStatus = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'IN_PROGRESS' : ticket.status;
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      // Notify assigned admin of customer response
      if (ticket.assignedAdminId) {
        await prisma.userNotification.create({
          data: {
            userId: ticket.assignedAdminId,
            title: `Customer Replied: ${ticket.subject}`,
            message: `${ticket.user.name || ticket.user.email} replied to ticket.`,
            type: 'INFO',
            actionUrl: `/admin/support?ticketId=${ticket.id}`,
          },
        }).catch(err => console.error('Failed to notify admin:', err));
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin/support');
    return { success: true, message: newMessage };
  } catch (err: any) {
    console.error('Error sending ticket message:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function closeSupportTicket(ticketId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return { success: false, error: 'Ticket not found.' };
    }

    if (ticket.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'OWNER') {
      return { success: false, error: 'Access denied.' };
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', updatedAt: new Date() },
    });

    revalidatePath('/dashboard');
    revalidatePath('/admin/support');
    return { success: true };
  } catch (err: any) {
    console.error('Error closing support ticket:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

// ==========================================
// ADMIN SUPPORT PORTAL ACTIONS
// ==========================================

export async function getAdminSupportTickets(options?: {
  status?: string;
  priority?: string;
  category?: string;
  assignedToMe?: boolean;
  search?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized', tickets: [], counts: {} as any };
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'OWNER')) {
      return { success: false, error: 'Admin access required', tickets: [], counts: {} as any };
    }

    // Build filter conditions
    const where: any = {};

    if (options?.status && options.status !== 'ALL') {
      where.status = options.status;
    }

    if (options?.priority && options.priority !== 'ALL') {
      where.priority = options.priority;
    }

    if (options?.category && options.category !== 'ALL') {
      where.category = options.category;
    }

    if (options?.assignedToMe) {
      where.assignedAdminId = currentUser.id;
    }

    if (options?.search && options.search.trim()) {
      const q = options.search.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { id: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Fetch matching tickets
    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subscription: true,
            accounts: {
              select: { id: true, role: true, broker: true },
            },
          },
        },
        assignedAdmin: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute metrics counts for tabs
    const [allCount, openCount, inProgressCount, resolvedCount, closedCount, myCount, unassignedCount] = await Promise.all([
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
      prisma.supportTicket.count({ where: { assignedAdminId: currentUser.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.supportTicket.count({ where: { assignedAdminId: null, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);

    return {
      success: true,
      currentAdminId: currentUser.id,
      tickets,
      counts: {
        all: allCount,
        open: openCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        closed: closedCount,
        myAssigned: myCount,
        unassigned: unassignedCount,
      },
    };
  } catch (err: any) {
    console.error('Error fetching admin support tickets:', err);
    return { success: false, error: formatUserFriendlyError(err), tickets: [], counts: {} as any };
  }
}

export async function updateTicketStatus(ticketId: string, status: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return { success: false, error: 'Admin access required' };
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status, updatedAt: new Date() },
    });

    revalidatePath('/admin/support');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating ticket status:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function updateTicketPriority(ticketId: string, priority: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return { success: false, error: 'Admin access required' };
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority, updatedAt: new Date() },
    });

    revalidatePath('/admin/support');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating ticket priority:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function assignTicketToAdmin(ticketId: string, adminId: string | null) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return { success: false, error: 'Admin access required' };
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedAdminId: adminId, updatedAt: new Date() },
      include: { user: true, assignedAdmin: true },
    });

    // Notify newly assigned admin
    if (adminId && adminId !== user.id) {
      await prisma.userNotification.create({
        data: {
          userId: adminId,
          title: `Ticket Reassigned to You`,
          message: `${user.name || user.email} assigned ticket "${ticket.subject}" to you.`,
          type: 'INFO',
          actionUrl: `/admin/support?ticketId=${ticket.id}`,
        },
      }).catch(err => console.error('Failed to notify admin:', err));
    }

    revalidatePath('/admin/support');
    return { success: true, ticket };
  } catch (err: any) {
    console.error('Error assigning ticket:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}

export async function getAdminStaffList() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized', staff: [] };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return { success: false, error: 'Admin access required', staff: [] };
    }

    const staff = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'OWNER'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            assignedSupportTickets: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, staff };
  } catch (err: any) {
    console.error('Error fetching admin staff list:', err);
    return { success: false, error: formatUserFriendlyError(err), staff: [] };
  }
}
