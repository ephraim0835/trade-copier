import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');
const FROM = 'Plaiz Markets <noreply@plaiz-markets.online>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://plaiz-markets.online';

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendVerificationEmail(email: string, name: string, token: string, expiresAtMs?: number) {
  const safeName = escapeHtml(name) || 'there';
  const expParam = expiresAtMs ? `&exp=${expiresAtMs}` : '';
  const link = `${BASE_URL}/verify-email/confirm?token=${token}${expParam}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your email — Activate your 5-Day Free Trial | Plaiz Markets',
    html: emailTemplate({
      title: 'Verify your email',
      preheader: 'Your 5-Day Free Trial is waiting (trading days only, weekends excluded).',
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${safeName},</p>
        <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">
          Welcome to <strong style="color:#fff;">Plaiz Markets</strong>! Your <strong style="color:#10b981;">5-Day Free Trial</strong> (5 full trading days, weekends excluded) is ready to be activated.
        </p>
        <p style="margin:0 0 32px;font-size:16px;color:#a1a1aa;">
          Click the button below to verify your email address and unlock your trading dashboard.
        </p>
      `,
      ctaLabel: 'Verify Email & Start 5-Day Trial',
      ctaUrl: link,
      footer: '⏳ This verification link expires in 15 minutes. If you didn\'t create an account, you can safely ignore this email.',
    }),
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const safeName = escapeHtml(name) || 'there';
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your Plaiz Markets password',
    html: emailTemplate({
      title: 'Reset your password',
      preheader: 'We received a request to reset your password.',
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${safeName},</p>
        <p style="margin:0 0 32px;font-size:16px;color:#a1a1aa;">
          We received a request to reset the password for your <strong style="color:#fff;">Plaiz Markets</strong> account. 
          Click the button below to choose a new password.
        </p>
      `,
      ctaLabel: 'Reset Password',
      ctaUrl: link,
      footer: 'This link expires in 1 hour. If you didn\'t request a password reset, you can safely ignore this email.',
    }),
  });
}

export async function sendPasswordResetCode(email: string, name: string, code: string) {
  const safeName = escapeHtml(name) || 'there';
  const safeCode = escapeHtml(code);
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your Plaiz Markets Password Reset Code',
    html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="background:#18181b;border:1px solid #27272a;border-radius:24px;padding:48px 40px;text-align:center;">
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#fff;">Password Reset Code</h1>
              <p style="margin:0 0 32px;font-size:16px;color:#a1a1aa;">
                Hi ${safeName},<br/><br/>
                You requested to change your password. Use the verification code below to proceed:
              </p>
              <div style="background:#27272a;padding:16px;border-radius:12px;display:inline-block;margin-bottom:32px;">
                <span style="font-size:32px;font-weight:800;color:#fff;letter-spacing:8px;">${safeCode}</span>
              </div>
              <p style="margin:0;font-size:12px;color:#52525b;">This code expires in 10 minutes. If you didn't request this, please secure your account.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

export async function sendSubscriptionReceiptEmail({
  email,
  name,
  planName,
  amount,
  currency,
  referenceId,
  periodEnd,
}: {
  email: string;
  name?: string | null;
  planName: string;
  amount: number | string;
  currency: string;
  referenceId: string;
  periodEnd?: Date | null;
}) {
  const safeName = escapeHtml(name) || 'Trader';
  const safePlan = escapeHtml(planName);
  const safeRef = escapeHtml(referenceId);
  const safeCurrency = escapeHtml(currency);
  const safeAmount = escapeHtml(String(amount));
  const formattedDate = periodEnd 
    ? new Date(periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'In 30 days';

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `🎉 Payment Receipt & Dispute Reference #${safeRef} | Plaiz Markets`,
    html: emailTemplate({
      title: 'Thank You for Your Subscription!',
      preheader: `Payment confirmed for ${safePlan.toUpperCase()} plan. Your Dispute Reference ID is ${safeRef}.`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${safeName},</p>
        <p style="margin:0 0 20px;font-size:16px;color:#a1a1aa;line-height:1.6;">
          Thank you for choosing <strong style="color:#fff;">Plaiz Markets</strong>! We have received your payment, and your <strong style="color:#10b981;">${safePlan.toUpperCase()}</strong> plan is now fully active. All trading copier features, multi-account bridges, and risk protection are unlocked.
        </p>

        <!-- Receipt & Dispute Details Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #3f3f46;">
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#a1a1aa;border-bottom:1px solid #3f3f46;">Plan Activated:</td>
            <td style="padding:8px 0;font-size:14px;color:#fff;font-weight:700;text-align:right;border-bottom:1px solid #3f3f46;text-transform:uppercase;">${safePlan}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#a1a1aa;border-bottom:1px solid #3f3f46;">Amount Paid:</td>
            <td style="padding:8px 0;font-size:14px;color:#10b981;font-weight:700;text-align:right;border-bottom:1px solid #3f3f46;">${safeCurrency.toUpperCase()} ${safeAmount}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#a1a1aa;border-bottom:1px solid #3f3f46;">Next Renewal Date:</td>
            <td style="padding:8px 0;font-size:14px;color:#fff;text-align:right;border-bottom:1px solid #3f3f46;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:14px;color:#a1a1aa;">Official Dispute Reference ID:</td>
            <td style="padding:8px 0;font-size:14px;color:#38bdf8;font-family:monospace;font-weight:700;text-align:right;">${safeRef}</td>
          </tr>
        </table>

        <div style="background:rgba(59, 130, 246, 0.1);border:1px solid rgba(59, 130, 246, 0.25);border-radius:12px;padding:14px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#93c5fd;line-height:1.5;">
            🛡️ <strong>Dispute Protection:</strong> Please retain your Reference ID (<strong>${safeRef}</strong>) in case of any billing questions, reconciliation, or payment disputes. Our support team can instantly verify your payment with this ID.
          </p>
        </div>
      `,
      ctaLabel: 'Go to Trading Dashboard',
      ctaUrl: `${BASE_URL}/dashboard`,
      footer: 'Need billing assistance or dispute resolution? Email support@plaiz-markets.online with your Reference ID.',
    }),
  }).catch((err) => {
    console.error('Failed to send subscription receipt email:', err);
  });
}

export async function sendAdminSubscriptionAlert({
  adminEmail,
  userEmail,
  userName,
  planName,
  amount,
  currency,
  referenceId,
  flwTxRef,
  flwTransactionId,
  flwCustomerId,
}: {
  adminEmail: string;
  userEmail: string;
  userName?: string | null;
  planName: string;
  amount: number | string;
  currency: string;
  referenceId: string;
  flwTxRef?: string | null;
  flwTransactionId?: string | null;
  flwCustomerId?: string | null;
}) {
  const safeRef = escapeHtml(referenceId);
  const safeUserEmail = escapeHtml(userEmail);
  const safeUserName = escapeHtml(userName) || 'N/A';
  const safePlan = escapeHtml(planName);
  const safeCurrency = escapeHtml(currency);
  const safeAmount = escapeHtml(String(amount));
  const safeTxRef = escapeHtml(flwTxRef) || 'N/A';
  const safeTxId = escapeHtml(flwTransactionId) || 'N/A';
  const safeCustId = escapeHtml(flwCustomerId) || 'N/A';

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `[Admin Dispute Log] New Subscription #${safeRef} — ${safeUserEmail}`,
    html: emailTemplate({
      title: 'New Subscription & Dispute Reference Recorded',
      preheader: `Dispute Log: Reference ${safeRef} for user ${safeUserEmail}`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Admin Notification,</p>
        <p style="margin:0 0 20px;font-size:16px;color:#a1a1aa;">
          A new subscription payment was successfully confirmed. Official dispute records and reference tokens have been generated:
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #3f3f46;">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Dispute Reference ID:</td>
            <td style="padding:6px 0;font-size:13px;color:#38bdf8;font-family:monospace;font-weight:700;text-align:right;">${safeRef}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Subscriber Email:</td>
            <td style="padding:6px 0;font-size:13px;color:#fff;text-align:right;">${safeUserEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Subscriber Name:</td>
            <td style="padding:6px 0;font-size:13px;color:#fff;text-align:right;">${safeUserName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Plan Tier:</td>
            <td style="padding:6px 0;font-size:13px;color:#fff;text-align:right;text-transform:uppercase;">${safePlan}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Amount Paid:</td>
            <td style="padding:6px 0;font-size:13px;color:#10b981;font-weight:700;text-align:right;">${safeCurrency.toUpperCase()} ${safeAmount}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Flutterwave TxRef:</td>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;font-family:monospace;text-align:right;">${safeTxRef}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Flutterwave Tx ID:</td>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;font-family:monospace;text-align:right;">${safeTxId}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;">Customer ID:</td>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;font-family:monospace;text-align:right;">${safeCustId}</td>
          </tr>
        </table>
      `,
      ctaLabel: 'View Admin Dashboard',
      ctaUrl: `${BASE_URL}/admin`,
      footer: 'Official internal dispute log for Plaiz Markets Administration.',
    }),
  }).catch((err) => {
    console.error('Failed to send admin subscription alert email:', err);
  });
}

function emailTemplate({ title, preheader, body, ctaLabel, ctaUrl, footer }: {
  title: string;
  preheader: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:16px;display:flex;align-items:center;justify-content:center;">
                    <img src="${BASE_URL}/plaiz-logo.png" alt="Plaiz Markets" width="32" height="32" style="display:block;width:32px;height:32px;object-fit:contain;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#18181b;border:1px solid #27272a;border-radius:24px;padding:48px 40px;">
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px;">${title}</h1>
              ${body}
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" 
                       style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;letter-spacing:-0.2px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback link -->
              <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Or copy this link into your browser:</p>
              <p style="margin:0;font-size:12px;color:#3b82f6;word-break:break-all;">${ctaUrl}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#52525b;">${footer}</p>
              <p style="margin:8px 0 0;font-size:12px;color:#3f3f46;">© ${new Date().getFullYear()} Plaiz Markets. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
