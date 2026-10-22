import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get('ticketId');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isOwnerOrAdmin = ticket.userId === user.id || user.role === 'ADMIN' || user.role === 'OWNER';
    if (!isOwnerOrAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const sanitizedMessages = ticket.messages.map(m => ({
      ...m,
      senderRole: m.senderId === ticket.userId ? 'USER' : m.senderRole,
    }));

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      status: ticket.status,
      priority: ticket.priority,
      assignedAdmin: ticket.assignedAdmin,
      messages: sanitizedMessages,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { ticketId, message = '', attachmentUrl, attachmentName, attachmentType } = body;

    const trimmedMessage = (message || '').trim();
    if (!ticketId || (!trimmedMessage && !attachmentUrl)) {
      return NextResponse.json({ error: 'ticketId and either a message or attachment are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true, assignedAdmin: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isOwnerOrAdmin = ticket.userId === user.id || user.role === 'ADMIN' || user.role === 'OWNER';
    if (!isOwnerOrAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const isCustomerReplying = ticket.userId === user.id;
    const senderRole = isCustomerReplying ? 'USER' : 'ADMIN';

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: user.id,
        senderRole,
        message: trimmedMessage || (attachmentName ? `[Attached: ${attachmentName}]` : '[Attachment]'),
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentType: attachmentType || null,
      },
    });

    // Update ticket status
    if (!isCustomerReplying) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
          updatedAt: new Date(),
        },
      });

      // Notify customer
      await prisma.userNotification.create({
        data: {
          userId: ticket.userId,
          title: `Support Agent Replied`,
          message: `Your ticket "${ticket.subject}" received a response from Plaiz Support.`,
          type: 'INFO',
          actionUrl: `/dashboard`,
        },
      }).catch(() => {});
    } else {
      const newStatus = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'IN_PROGRESS' : ticket.status;
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      // Notify admin
      if (ticket.assignedAdminId) {
        await prisma.userNotification.create({
          data: {
            userId: ticket.assignedAdminId,
            title: `Customer Replied: ${ticket.subject}`,
            message: `${ticket.user.name || ticket.user.email} replied to ticket.`,
            type: 'INFO',
            actionUrl: `/admin/support?ticketId=${ticket.id}`,
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        ...newMessage,
        senderRole,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
