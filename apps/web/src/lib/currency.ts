/**
 * Standardized Currency Conversion Utility
 * Used across Server Components and Client Components to ensure 
 * consistent portfolio valuations across multi-currency accounts (USD, NGN, EUR, GBP, JPY).
 */

export const DEFAULT_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  NGN: 1600.0, // 1600 NGN per 1 USD
  EUR: 0.92,   // ~1.087 USD per 1 EUR
  GBP: 0.78,   // ~1.282 USD per 1 GBP
  CAD: 1.38,
  AUD: 1.53,
  JPY: 152.0,
  CHF: 0.88,
  ZAR: 18.2,
};

/**
 * Converts any currency amount to USD (base portfolio reference currency)
 */
export function convertToUSD(amount: number, fromCurrency: string = 'USD', liveNgnRate?: number): number {
  if (!amount || isNaN(amount)) return 0;
  const code = (fromCurrency || 'USD').toUpperCase().trim();
  if (code === 'USD') return amount;

  if (code === 'NGN' && liveNgnRate && liveNgnRate > 0) {
    return amount / liveNgnRate;
  }

  const rate = DEFAULT_RATES_TO_USD[code] || 1.0;
  return rate > 0 ? amount / rate : amount;
}

/**
 * Converts USD amount to a target currency (e.g. for display in NGN)
 */
export function convertFromUSD(amountUSD: number, toCurrency: string = 'USD', liveNgnRate?: number): number {
  if (!amountUSD || isNaN(amountUSD)) return 0;
  const code = (toCurrency || 'USD').toUpperCase().trim();
  if (code === 'USD') return amountUSD;

  if (code === 'NGN' && liveNgnRate && liveNgnRate > 0) {
    return amountUSD * liveNgnRate;
  }

  const rate = DEFAULT_RATES_TO_USD[code] || 1.0;
  return rate > 0 ? amountUSD * rate : amountUSD;
}
