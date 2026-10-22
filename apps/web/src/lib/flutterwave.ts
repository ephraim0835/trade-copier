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
    ''
  ).toLowerCase().trim();

  const secretKey = (
    process.env.FLW_LIVE_SECRET_KEY || 
    process.env.FLW_SECRET_KEY || 
    ''
  ).trim();

  const publicKey = (
    process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY ||
    process.env.FLW_LIVE_PUBLIC_KEY || 
    process.env.FLW_PUBLIC_KEY || 
    ''
  ).trim();

  const encryptionKey = (
    process.env.FLW_LIVE_ENCRYPTION_KEY || 
    process.env.FLW_ENCRYPTION_KEY || 
    ''
  ).trim();

  // If the secret key starts with live prefix FLWSECK- (and not FLWSECK_TEST), it is inherently LIVE.
  const isKeyExplicitlyLive = (secretKey.startsWith('FLWSECK-') && !secretKey.includes('_TEST')) ||
                              (publicKey.startsWith('FLWPUBK-') && !publicKey.includes('_TEST'));
  const isLive = mode === 'live' || isKeyExplicitlyLive;

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
