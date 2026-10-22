/**
 * Standardized Currency Conversion Utility
 * Used across Server Components and Client Components to ensure 
 * consistent portfolio valuations across multi-currency accounts (USD, NGN, EUR, GBP, JPY).
 */

export const DEFAULT_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  NGN: 1350.0, // Fallback rate if network is unavailable
  EUR: 0.89,   
  GBP: 0.75,   
  CAD: 1.38,
  AUD: 1.53,
  JPY: 152.0,
  CHF: 0.88,
  ZAR: 18.2,
};

// In-memory cache for live exchange rates
let cachedRates: Record<string, number> = { ...DEFAULT_RATES_TO_USD };
let lastFetchedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Fetches real-time exchange rates from public forex stream with in-memory caching
 */
export async function fetchLiveRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - lastFetchedAt < CACHE_TTL_MS && Object.keys(cachedRates).length > 2) {
    return cachedRates;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
      next: { revalidate: 300 } // Next.js cache 5 mins
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === 'object') {
        cachedRates = {
          ...DEFAULT_RATES_TO_USD,
          ...data.rates,
          USD: 1.0,
        };
        lastFetchedAt = now;
        return cachedRates;
      }
    }
  } catch (err) {
    console.warn('[Currency] Primary live rates fetch failed, trying secondary stream:', err);
  }

  // Secondary stream: api.exchangerate-api.com
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === 'object') {
        cachedRates = {
          ...DEFAULT_RATES_TO_USD,
          ...data.rates,
          USD: 1.0,
        };
        lastFetchedAt = now;
        return cachedRates;
      }
    }
  } catch (err) {
    console.warn('[Currency] Secondary live rates fetch failed, using cached/fallback rates:', err);
  }

  return cachedRates;
}

/**
 * Retrieves the current live exchange rate for a given currency code vs USD
 */
export async function getLiveRate(currencyCode: string = 'USD'): Promise<number> {
  const code = (currencyCode || 'USD').toUpperCase().trim();
  if (code === 'USD') return 1.0;
  const rates = await fetchLiveRates();
  return rates[code] || DEFAULT_RATES_TO_USD[code] || 1.0;
}

/**
 * Converts any currency amount to USD (base portfolio reference currency)
 */
export function convertToUSD(amount: number, fromCurrency: string = 'USD', liveRatesOrRate?: Record<string, number> | number): number {
  if (!amount || isNaN(amount)) return 0;
  const code = (fromCurrency || 'USD').toUpperCase().trim();
  if (code === 'USD') return amount;

  if (typeof liveRatesOrRate === 'number' && liveRatesOrRate > 0) {
    return amount / liveRatesOrRate;
  }

  const rateTable = (typeof liveRatesOrRate === 'object' && liveRatesOrRate) ? liveRatesOrRate : cachedRates;
  const rate = rateTable[code] || DEFAULT_RATES_TO_USD[code] || 1.0;
  return rate > 0 ? amount / rate : amount;
}

/**
 * Converts USD amount to a target currency (e.g. for display in NGN)
 */
export function convertFromUSD(amountUSD: number, toCurrency: string = 'USD', liveRatesOrRate?: Record<string, number> | number): number {
  if (!amountUSD || isNaN(amountUSD)) return 0;
  const code = (toCurrency || 'USD').toUpperCase().trim();
  if (code === 'USD') return amountUSD;

  if (typeof liveRatesOrRate === 'number' && liveRatesOrRate > 0) {
    return amountUSD * liveRatesOrRate;
  }

  const rateTable = (typeof liveRatesOrRate === 'object' && liveRatesOrRate) ? liveRatesOrRate : cachedRates;
  const rate = rateTable[code] || DEFAULT_RATES_TO_USD[code] || 1.0;
  return rate > 0 ? amountUSD * rate : amountUSD;
}
