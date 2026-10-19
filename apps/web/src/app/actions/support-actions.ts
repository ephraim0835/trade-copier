'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { formatUserFriendlyError } from '@/lib/error-formatter';

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

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: data.subject.trim(),
        category: data.category || 'GENERAL',
        priority,
        status: 'OPEN',
        messages: {
          create: {
            senderId: user.id,
            senderRole: user.role === 'ADMIN' || user.role === 'OWNER' ? 'ADMIN' : 'USER',
            message: data.message.trim(),
          },
        },
      },
      include: {
        messages: true,
      },
    });

    revalidatePath('/dashboard');
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
    });

    if (!ticket) {
      return { success: false, error: 'Ticket not found.' };
    }

    if (ticket.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'OWNER') {
      return { success: false, error: 'Access denied.' };
    }

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: user.id,
        senderRole: user.role === 'ADMIN' || user.role === 'OWNER' ? 'ADMIN' : 'USER',
        message: message.trim(),
      },
    });

    // Reopen ticket if user sends a message on resolved/closed ticket
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      });
    } else {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });
    }

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
      data: { status: 'RESOLVED' },
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error closing support ticket:', err);
    return { success: false, error: formatUserFriendlyError(err) };
  }
}
