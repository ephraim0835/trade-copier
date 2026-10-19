/**
 * error-formatter.ts
 * Translates raw technical errors (Prisma, database internals, terminal log traces, etc.)
 * into clean, user-friendly, and professional normal messages.
 */

export interface FriendlyError {
  title: string;
  message: string;
  suggestion?: string;
  isPlanLimit?: boolean;
}

export function formatUserFriendlyError(rawError: unknown): string {
  const details = getFriendlyErrorDetails(rawError);
  return details.message;
}

export function getFriendlyErrorDetails(rawError: unknown): FriendlyError {
  if (!rawError) {
    return {
      title: 'Connection Issue',
      message: 'An unexpected issue occurred while processing your request. Please try again.',
      suggestion: 'If the issue persists, verify your credentials or contact support.'
    };
  }

  let raw = '';
  if (typeof rawError === 'string') {
    raw = rawError;
  } else if (typeof rawError === 'object' && rawError !== null) {
    const err = rawError as any;
    raw = err.message || err.error || err.statusText || JSON.stringify(rawError);
  } else {
    raw = String(rawError);
  }

  // Strip raw log timestamps (e.g., '2026.10.16 12:34:56.789 Trades ')
  const cleanStr = raw.replace(/^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}(\.\d+)?\s+/g, '').trim();
  const lower = cleanStr.toLowerCase();

  // 1. Prisma Unique Constraint (Account already exists)
  if (
    lower.includes('unique constraint') ||
    lower.includes('p2002') ||
    lower.includes('unique constraint failed on the fields: (login, broker, server)') ||
    lower.includes('already exists')
  ) {
    return {
      title: 'Account Already Connected',
      message: 'This MT5 account is already linked to your portfolio.',
      suggestion: 'If you want to update its password or settings, simply re-enter your details to update it.'
    };
  }

  // 2. Account linked to another user
  if (lower.includes('already linked to another user account')) {
    return {
      title: 'Account In Use',
      message: cleanStr,
      suggestion: 'Each MT5 account can only belong to one user. Log in to that user account or disconnect it first.'
    };
  }

  // 3. Plan Limit Reached or Subscription Required
  if (
    lower.includes('plan limit') ||
    lower.includes('limit reached') ||
    lower.includes('upgrade to pro') ||
    lower.includes('plan_limit_reached')
  ) {
    return {
      title: 'Plan Limit Reached',
      message: cleanStr,
      suggestion: 'Visit Pricing to upgrade your subscription plan and connect more trading terminals.',
      isPlanLimit: true
    };
  }

  if (
    lower.includes('active subscription required') ||
    lower.includes('subscription required') ||
    lower.includes('paywall_required')
  ) {
    return {
      title: 'Subscription Required',
      message: cleanStr.includes('An active subscription') 
        ? cleanStr 
        : 'An active plan is required to link accounts and execute automated trades.',
      suggestion: 'Please visit the Pricing page to choose a plan and activate trade copying.',
      isPlanLimit: true
    };
  }

  // 4. Unauthorized / Access Denied
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('access denied')) {
    return {
      title: 'Access Denied',
      message: 'Your session has expired or you do not have permission to perform this action.',
      suggestion: 'Please refresh the page or sign in again.'
    };
  }

  // 5. User or Record Not Found
  if (lower.includes('record not found') || lower.includes('p2025') || lower.includes('not found')) {
    return {
      title: 'Record Not Found',
      message: 'The requested account or configuration could not be found.',
      suggestion: 'Please refresh the page to view current records.'
    };
  }

  // 6. Database Connection Failure
  if (
    lower.includes('can\'t reach database server') ||
    lower.includes('prismaclientinitializationerror') ||
    lower.includes('connection refused') ||
    lower.includes('database error')
  ) {
    return {
      title: 'Server Connection Busy',
      message: 'Unable to establish a secure link to the database at this moment.',
      suggestion: 'Please wait a few moments and try your request again.'
    };
  }

  // 7. Broker Authorization / Invalid Account
  if (
    lower.includes('invalid account') ||
    lower.includes('invalid account number') ||
    (lower.includes('authorization') && lower.includes('invalid'))
  ) {
    return {
      title: 'Invalid Account Number',
      message: 'The broker server does not recognize this MT5 account number.',
      suggestion: 'Please double-check your account number in your broker portal or welcome email.'
    };
  }

  // 8. Incorrect Trading Password
  if (
    lower.includes('incorrect password') ||
    lower.includes('invalid password') ||
    (lower.includes('authorization') && lower.includes('failed') && !lower.includes('timeout'))
  ) {
    return {
      title: 'Incorrect Trading Password',
      message: 'The password entered does not match this MT5 account.',
      suggestion: 'Please check your master trading password (not your read-only investor password).'
    };
  }

  // 9. Investor (Read-Only) Password Detected
  if (lower.includes('investor') || lower.includes('read-only')) {
    return {
      title: 'Investor Password Detected',
      message: 'You entered a read-only investor password.',
      suggestion: 'Trade Copier requires your Master/Trading password so trades can be executed.'
    };
  }

  // 10. Account or Trading Disabled by Broker
  if (lower.includes('trading disabled') || lower.includes('account disabled') || lower.includes('archived')) {
    return {
      title: 'Account Disabled by Broker',
      message: 'Trading permissions for this MT5 account have been disabled by your broker.',
      suggestion: 'Please contact your broker support to verify the account status.'
    };
  }

  // 11. Invalid Server Name / Server Not Responding
  if (
    lower.includes('0 access points found') ||
    lower.includes('server not responding') ||
    lower.includes('connect failed') ||
    lower.includes('invalid server name') ||
    lower.includes('cannot connect to')
  ) {
    return {
      title: 'Broker Server Unreachable',
      message: 'The terminal could not connect to the specified broker server.',
      suggestion: 'Check the exact server name in your MT5 terminal (e.g., JustMarkets-Demo3 or ICMarketsSC-Live01).'
    };
  }

  // 12. EA Initialization Timeout
  if (
    lower.includes('ea initialization timeout') ||
    lower.includes('no heartbeat') ||
    lower.includes('timed out waiting')
  ) {
    return {
      title: 'Connection Timed Out',
      message: 'The broker server did not respond to the login request within the time limit.',
      suggestion: 'Please verify that your broker server name and credentials are correct, then retry.'
    };
  }

  // 13. Capacity Limits
  if (lower.includes('capacity limit') || lower.includes('vps capacity')) {
    return {
      title: 'System Temporarily Busy',
      message: 'The terminal server is currently experiencing high load.',
      suggestion: 'Please wait 1-2 minutes and try connecting again.'
    };
  }

  // 14. EA Token / Session Authorization
  if (lower.includes('ea token') || lower.includes('webrequest failed with code 401')) {
    return {
      title: 'Authentication Session Expired',
      message: 'The trading terminal could not authenticate its session with the server.',
      suggestion: 'Please click Retry to generate a fresh terminal session.'
    };
  }

  // 15. WebRequest permissions
  if (lower.includes('webrequest') || lower.includes('common.ini')) {
    return {
      title: 'Terminal Network Permissions',
      message: 'The terminal requires WebRequest permissions to synchronize live trades.',
      suggestion: 'Our automated system will configure this on the next connection attempt.'
    };
  }

  // 16. Raw code or internal exceptions check
  if (
    lower.includes('prisma.') ||
    lower.includes('invocation:') ||
    lower.includes('syntaxerror') ||
    lower.includes('typeerror') ||
    lower.includes('uncaught') ||
    lower.includes('object.<anonymous>') ||
    cleanStr.includes('{\n') ||
    cleanStr.includes('{"')
  ) {
    return {
      title: 'Operation Failed',
      message: 'A technical issue occurred while communicating with the server. Please try again.',
      suggestion: 'If the problem persists, our engineering team has been notified.'
    };
  }

  // Clean up any "Error:" prefix if present
  let displayMessage = cleanStr.replace(/^error:\s*/i, '').trim();

  // Capitalize first letter and ensure ending period
  if (displayMessage.length > 0) {
    displayMessage = displayMessage.charAt(0).toUpperCase() + displayMessage.slice(1);
    if (!/[.!?]$/.test(displayMessage)) {
      displayMessage += '.';
    }
  }

  return {
    title: 'Connection Error',
    message: displayMessage || 'The connection could not be completed at this time.',
    suggestion: 'Please verify your account details and try again.'
  };
}
