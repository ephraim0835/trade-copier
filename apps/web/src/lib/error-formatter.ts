/**
 * error-formatter.ts
 * Translates raw technical errors (MT5 retcodes, broker terminal messages,
 * Prisma exceptions, database internals, network traces, etc.)
 * into clean, user-friendly, and professional plain English messages.
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
    raw = err.message || err.error || err.statusText || '';
    if (!raw) {
      try {
        raw = JSON.stringify(rawError);
      } catch {
        raw = String(rawError);
      }
    }
  } else {
    raw = String(rawError);
  }

  // Strip raw log timestamps (e.g., '2026.10.16 12:34:56.789 Trades ')
  let cleanStr = raw.replace(/^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}(\.\d+)?\s+/g, '').trim();

  // Strip common technical prefixes like "Error: ", "Exception: ", "Unhandled: "
  cleanStr = cleanStr.replace(/^(error|exception|runtimeerror|unhandled|fatal):\s*/i, '').trim();

  // If the error message is a JSON string, try parsing it for nested messages
  if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleanStr);
      if (parsed.message) cleanStr = String(parsed.message);
      else if (parsed.error) cleanStr = String(parsed.error);
    } catch {
      // ignore JSON parse failure
    }
  }

  const lower = cleanStr.toLowerCase();

  // -------------------------------------------------------------------------
  // 1. Prisma & Database Exceptions
  // -------------------------------------------------------------------------
  if (
    lower.includes('unique constraint') ||
    lower.includes('p2002') ||
    lower.includes('unique constraint failed on the fields: (login, broker, server)') ||
    lower.includes('already exists')
  ) {
    return {
      title: 'Account Already Connected',
      message: 'This MT5 account is already linked to your portfolio.',
      suggestion: 'If you want to update its password or server settings, click Update Credentials.'
    };
  }

  if (lower.includes('already linked to another user account')) {
    return {
      title: 'Account In Use',
      message: cleanStr,
      suggestion: 'Each MT5 account can only belong to one user. Log in to that user account or disconnect it first.'
    };
  }

  if (lower.includes('record not found') || lower.includes('p2025') || lower.includes('not found')) {
    return {
      title: 'Record Not Found',
      message: 'The requested account or configuration could not be found.',
      suggestion: 'Please refresh the page to view current records.'
    };
  }

  if (lower.includes('p2003') || lower.includes('foreign key constraint')) {
    return {
      title: 'Record In Use',
      message: 'Cannot delete this account because it has active trade records associated with it.',
      suggestion: 'The system will clean up trade associations automatically upon account disconnect.'
    };
  }

  if (
    lower.includes('can\'t reach database server') ||
    lower.includes('prismaclientinitializationerror') ||
    lower.includes('connection refused') ||
    lower.includes('database error')
  ) {
    return {
      title: 'Database Connection Busy',
      message: 'Unable to communicate with the database right now. Please try again shortly.',
      suggestion: 'Please wait a few moments and try your request again.'
    };
  }

  // -------------------------------------------------------------------------
  // 2. Subscription, Paywall & Plan Limits
  // -------------------------------------------------------------------------
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
    lower.includes('paywall_required') ||
    lower.includes('trial has expired') ||
    lower.includes('grace period')
  ) {
    return {
      title: lower.includes('grace period') ? 'Trial Expired (Grace Period)' : (lower.includes('trial') ? 'Trial Expired' : 'Subscription Required'),
      message: cleanStr.includes('trial') || cleanStr.includes('subscription')
        ? cleanStr 
        : 'An active plan is required to link accounts and execute automated trades.',
      suggestion: 'Please visit the Pricing page to choose a plan and activate trade copying.',
      isPlanLimit: true
    };
  }

  // -------------------------------------------------------------------------
  // 3. User Authorization & Sessions
  // -------------------------------------------------------------------------
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('access denied')) {
    return {
      title: 'Access Denied',
      message: 'Your session has expired or you do not have permission to perform this action.',
      suggestion: 'Please refresh the page or sign in again.'
    };
  }

  if (lower.includes('ea token') || lower.includes('webrequest failed with code 401')) {
    return {
      title: 'Authentication Session Expired',
      message: 'The trading terminal could not authenticate its session with the server.',
      suggestion: 'Please click Reconnect to refresh your terminal session.'
    };
  }

  // -------------------------------------------------------------------------
  // 4. Broker MT5 Credentials & Account Verification
  // -------------------------------------------------------------------------
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

  if (lower.includes('investor') || lower.includes('read-only')) {
    return {
      title: 'Investor Password Detected',
      message: 'You entered a read-only investor password.',
      suggestion: 'Trade Copier requires your Master/Trading password so trades can be executed.'
    };
  }

  if (lower.includes('trading disabled') || lower.includes('account disabled') || lower.includes('archived')) {
    return {
      title: 'Account Disabled by Broker',
      message: 'Trading permissions for this MT5 account have been disabled by your broker.',
      suggestion: 'Please contact your broker support to verify the account status.'
    };
  }

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

  // -------------------------------------------------------------------------
  // 5. MT5 Retcodes & Live Trade Execution Errors (Plain English)
  // -------------------------------------------------------------------------
  if (
    lower.includes('10019') ||
    lower.includes('no_money') ||
    lower.includes('not enough money') ||
    lower.includes('insufficient margin')
  ) {
    return {
      title: 'Insufficient Margin',
      message: 'Your account does not have enough free margin to place this trade.',
      suggestion: 'Deposit additional funds into your MT5 account or lower your lot size in Risk Settings.'
    };
  }

  if (
    lower.includes('10018') ||
    lower.includes('market_closed') ||
    lower.includes('market is closed') ||
    lower.includes('market closed')
  ) {
    return {
      title: 'Market is Closed',
      message: 'The financial market for this trading instrument is currently closed.',
      suggestion: 'Trades will resume once normal trading hours open for this symbol.'
    };
  }

  if (
    lower.includes('10014') ||
    lower.includes('invalid_volume') ||
    lower.includes('invalid volume')
  ) {
    return {
      title: 'Invalid Trade Lot Size',
      message: 'The calculated trade size does not meet your broker’s lot requirements (below minimum lot or above maximum).',
      suggestion: 'Adjust your risk multiplier or fixed lot size in Risk Engine settings.'
    };
  }

  if (
    lower.includes('10016') ||
    lower.includes('invalid_stops') ||
    lower.includes('invalid stops')
  ) {
    return {
      title: 'Invalid Stop Loss / Take Profit',
      message: 'The requested stop loss or take profit price was rejected by your broker (too close to market price or prohibited).',
      suggestion: 'Check your broker’s minimum stop distance requirements for this symbol.'
    };
  }

  if (
    lower.includes('10015') ||
    lower.includes('invalid_price') ||
    lower.includes('invalid price')
  ) {
    return {
      title: 'Invalid Trade Price',
      message: 'The execution price is no longer valid on the broker server.',
      suggestion: 'The copier will synchronize with the newest active price.'
    };
  }

  if (
    lower.includes('10021') ||
    lower.includes('price_off') ||
    lower.includes('off quotes') ||
    lower.includes('no quotes')
  ) {
    return {
      title: 'No Live Quotes (Off Quotes)',
      message: 'Your broker is temporarily not providing live market prices for this instrument.',
      suggestion: 'Prices should resume once market liquidity returns.'
    };
  }

  if (
    lower.includes('10004') ||
    lower.includes('requote') ||
    lower.includes('price changed')
  ) {
    return {
      title: 'Price Changed (Requote)',
      message: 'The market price changed while the trade was being transmitted to your broker.',
      suggestion: 'The copier will automatically retry with the latest available market quote.'
    };
  }

  if (
    lower.includes('10006') ||
    lower.includes('reject') ||
    lower.includes('rejected')
  ) {
    return {
      title: 'Trade Rejected by Broker',
      message: 'The broker rejected this trade order request.',
      suggestion: 'Check your broker’s account rules and margin requirements.'
    };
  }

  if (
    lower.includes('10026') ||
    lower.includes('server_disables_at') ||
    lower.includes('autotrading disabled by server')
  ) {
    return {
      title: 'Automated Trading Disabled by Broker',
      message: 'Your broker has disabled automated EA trading on this account server.',
      suggestion: 'Log in to your broker portal or contact support to enable algorithmic trading.'
    };
  }

  if (
    lower.includes('10027') ||
    lower.includes('client_disables_at') ||
    lower.includes('autotrading disabled by client')
  ) {
    return {
      title: 'Automated Trading Disabled in Terminal',
      message: 'Automated trading is currently turned off in MT5 settings.',
      suggestion: 'Click Reconnect to allow the copier to re-enable automated execution.'
    };
  }

  if (
    lower.includes('10028') ||
    lower.includes('locked') ||
    lower.includes('trade context busy') ||
    lower.includes('context is busy')
  ) {
    return {
      title: 'Broker Trade Engine Busy',
      message: 'The broker trading pipeline is temporarily busy processing another order.',
      suggestion: 'The order will be processed as soon as the broker queue clears.'
    };
  }

  if (
    lower.includes('10030') ||
    lower.includes('invalid_fill') ||
    lower.includes('unsupported fill mode')
  ) {
    return {
      title: 'Unsupported Order Fill Type',
      message: 'The broker does not support the requested execution policy (e.g., Fill or Kill).',
      suggestion: 'The trade will execute using the broker’s default execution mode.'
    };
  }

  if (
    lower.includes('10033') ||
    lower.includes('limit_orders')
  ) {
    return {
      title: 'Maximum Orders Limit Reached',
      message: 'Your MT5 account has reached the broker’s maximum allowed number of open and pending orders.',
      suggestion: 'Close or cancel unused orders in your MT5 account to free up capacity.'
    };
  }

  if (
    lower.includes('10034') ||
    lower.includes('limit_volume')
  ) {
    return {
      title: 'Maximum Volume Limit Reached',
      message: 'The total open volume on this instrument has reached your broker’s limit.',
      suggestion: 'Close existing positions before opening new trades on this symbol.'
    };
  }

  if (
    lower.includes('10039') ||
    lower.includes('limit_positions')
  ) {
    return {
      title: 'Maximum Positions Limit Reached',
      message: 'Your account has reached the maximum number of simultaneous open positions allowed by your broker.',
      suggestion: 'Close open positions on your account before opening new ones.'
    };
  }

  // -------------------------------------------------------------------------
  // 6. Risk Engine & Slippage Guardrails (Plain English)
  // -------------------------------------------------------------------------
  if (
    lower.includes('max_daily_risk') ||
    lower.includes('daily risk limit') ||
    lower.includes('daily drawdown')
  ) {
    return {
      title: 'Daily Risk Limit Reached',
      message: 'Trading has been paused because your daily drawdown limit was reached.',
      suggestion: 'Your account is protected from further losses until the next trading day.'
    };
  }

  if (
    lower.includes('max_sl') ||
    lower.includes('stop loss exceeds')
  ) {
    return {
      title: 'Stop Loss Risk Exceeded',
      message: 'The master trade’s stop loss exceeds your configured maximum risk limit.',
      suggestion: 'Adjust your risk settings if you want to copy trades with wider stop losses.'
    };
  }

  if (
    lower.includes('slippage') ||
    lower.includes('max slippage')
  ) {
    return {
      title: 'Slippage Guard Triggered',
      message: 'The market price drifted beyond your allowed slippage threshold.',
      suggestion: 'The trade was skipped to protect you from entering at an unfavorable price.'
    };
  }

  // -------------------------------------------------------------------------
  // 7. Network & Server Errors
  // -------------------------------------------------------------------------
  if (
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('socket hang up')
  ) {
    return {
      title: 'Network Communication Error',
      message: 'Unable to reach the server. Please check your internet connection and try again.',
      suggestion: 'Ensure you have an active internet connection, then retry.'
    };
  }

  if (
    lower.includes('bad gateway') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('gateway timeout')
  ) {
    return {
      title: 'Server Temporarily Busy',
      message: 'The server is temporarily busy processing requests. Please wait a moment.',
      suggestion: 'Please try again in 1-2 minutes.'
    };
  }

  if (
    lower.includes('encryption_key') ||
    lower.includes('hex characters') ||
    lower.includes('32 bytes') ||
    lower.includes('environment variable') ||
    lower.includes('bad decrypt') ||
    lower.includes('decryption') ||
    lower.includes('cipher')
  ) {
    return {
      title: 'Security Configuration Notice',
      message: 'A secure encryption verification issue occurred while saving your credentials. Please re-enter your details.',
      suggestion: 'Click "Edit Credentials & Try Again" to re-submit your login details.'
    };
  }

  if (lower.includes('capacity limit') || lower.includes('vps capacity')) {
    return {
      title: 'System Temporarily Busy',
      message: 'The terminal server is currently experiencing high load.',
      suggestion: 'Please wait 1-2 minutes and try connecting again.'
    };
  }

  if (lower.includes('webrequest') || lower.includes('common.ini')) {
    return {
      title: 'Terminal Network Permissions',
      message: 'The terminal requires WebRequest permissions to synchronize live trades.',
      suggestion: 'Our automated system will configure this on the next connection attempt.'
    };
  }

  // -------------------------------------------------------------------------
  // 8. Raw Code, Stack Traces or Uncaught Exceptions Sanitizer
  // -------------------------------------------------------------------------
  if (
    lower.includes('prisma.') ||
    lower.includes('invocation:') ||
    lower.includes('syntaxerror') ||
    lower.includes('typeerror') ||
    lower.includes('uncaught') ||
    lower.includes('referenceerror') ||
    lower.includes('cannot read properties') ||
    lower.includes('object.<anonymous>') ||
    cleanStr.includes('{\n') ||
    cleanStr.includes('{"') ||
    cleanStr.includes('at ') ||
    cleanStr.includes('.ts:') ||
    cleanStr.includes('.js:')
  ) {
    return {
      title: 'Operation Failed',
      message: 'A technical issue occurred while communicating with the server. Please try again.',
      suggestion: 'If the problem persists, our engineering team has been notified.'
    };
  }

  // Clean up any remaining "Error:" prefix if present
  let displayMessage = cleanStr.replace(/^error:\s*/i, '').trim();

  // If message contains raw code symbols or snake_case, make it friendly
  if (displayMessage.includes('_') && !displayMessage.includes(' ')) {
    displayMessage = displayMessage.replace(/_/g, ' ').toLowerCase();
  }

  // Capitalize first letter and ensure ending period
  if (displayMessage.length > 0) {
    displayMessage = displayMessage.charAt(0).toUpperCase() + displayMessage.slice(1);
    if (!/[.!?]$/.test(displayMessage)) {
      displayMessage += '.';
    }
  }

  return {
    title: 'Notice',
    message: displayMessage || 'The operation could not be completed at this time.',
    suggestion: 'Please verify your details and try again.'
  };
}
