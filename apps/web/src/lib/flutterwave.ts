/**
 * Flutterwave Configuration & Gateway Helper
 * Handles seamless switching between Sandbox (Test) mode and Live mode.
 */

export interface FlutterwaveConfig {
  isLive: boolean;
  secretKey: string;
  publicKey: string;
  encryptionKey: string;
}

export function getFlutterwaveConfig(): FlutterwaveConfig {
  const mode = (
    process.env.FLW_MODE || 
    process.env.NEXT_PUBLIC_FLW_MODE || 
    'test'
  ).toLowerCase().trim();

  const isLive = mode === 'live';

  const secretKey = isLive
    ? (process.env.FLW_LIVE_SECRET_KEY || process.env.FLW_SECRET_KEY || '')
    : (process.env.FLW_SECRET_KEY || '');

  const publicKey = isLive
    ? (process.env.FLW_LIVE_PUBLIC_KEY || process.env.FLW_PUBLIC_KEY || '')
    : (process.env.FLW_PUBLIC_KEY || '');

  const encryptionKey = isLive
    ? (process.env.FLW_LIVE_ENCRYPTION_KEY || process.env.FLW_ENCRYPTION_KEY || '')
    : (process.env.FLW_ENCRYPTION_KEY || '');

  return {
    isLive,
    secretKey,
    publicKey,
    encryptionKey,
  };
}

export const FLUTTERWAVE_TEST_CARD = {
  cardNumber: '5531 8866 5214 2950',
  expiry: '09/32',
  cvv: '564',
  pin: '3310',
  otp: '12345',
  cardType: 'Mastercard (Sandbox)',
};
