import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');
const FROM = 'Plaiz Markets <noreply@plaiz-markets.online>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://plaiz-markets.online';

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const link = `${BASE_URL}/verify-email/confirm?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your Plaiz Markets account',
    html: emailTemplate({
      title: 'Verify your email',
      preheader: 'One click and you\'re in.',
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${name || 'there'},</p>
        <p style="margin:0 0 32px;font-size:16px;color:#a1a1aa;">
          Thanks for signing up for <strong style="color:#fff;">Plaiz Markets</strong>. 
          Click the button below to verify your email address and activate your account.
        </p>
      `,
      ctaLabel: 'Verify Email Address',
      ctaUrl: link,
      footer: 'This link expires in 24 hours. If you didn\'t create an account, you can safely ignore this email.',
    }),
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your Plaiz Markets password',
    html: emailTemplate({
      title: 'Reset your password',
      preheader: 'We received a request to reset your password.',
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#a1a1aa;">Hi ${name || 'there'},</p>
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
                Hi ${name || 'there'},<br/><br/>
                You requested to change your password. Use the verification code below to proceed:
              </p>
              <div style="background:#27272a;padding:16px;border-radius:12px;display:inline-block;margin-bottom:32px;">
                <span style="font-size:32px;font-weight:800;color:#fff;letter-spacing:8px;">${code}</span>
              </div>
              <p style="margin:0;font-size:12px;color:#52525b;">This code expires in 10 minutes. If you didn't request this, please secure your account.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
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
