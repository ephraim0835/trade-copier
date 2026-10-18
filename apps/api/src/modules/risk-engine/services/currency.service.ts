import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class CurrencyService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyService.name);

  // Exchange rates: units of target currency per 1 USD
  private rates: Record<string, number> = {
    USD: 1.0,
    NGN: 1600.0,
    EUR: 0.92,
    GBP: 0.78,
    CAD: 1.38,
    AUD: 1.53,
    JPY: 152.0,
    CHF: 0.88,
    ZAR: 18.2,
    NZD: 1.66,
    CNY: 7.25,
  };

  private lastFetch = 0;
  private readonly REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  async onModuleInit() {
    await this.refreshRates();
  }

  async refreshRates() {
    const now = Date.now();
    if (now - this.lastFetch < this.REFRESH_INTERVAL_MS && this.lastFetch > 0) {
      return;
    }

    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          for (const [curr, rate] of Object.entries(data.rates)) {
            if (typeof rate === 'number' && rate > 0) {
              this.rates[curr.toUpperCase()] = rate;
            }
          }
          this.lastFetch = now;
          this.logger.log(`[CurrencyService] Refreshed FX rates. USD/NGN: ${this.rates['NGN']}, USD/EUR: ${this.rates['EUR']}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[CurrencyService] Could not fetch live FX rates (${err.message}). Using fallback rates.`);
    }
  }

  public getRateToUSD(currency: string): number {
    const code = (currency || 'USD').toUpperCase().trim();
    return this.rates[code] || 1.0;
  }

  public toUSD(amount: number, fromCurrency: string): number {
    if (!amount || isNaN(amount)) return 0;
    const code = (fromCurrency || 'USD').toUpperCase().trim();
    if (code === 'USD') return amount;
    const rate = this.getRateToUSD(code);
    return rate > 0 ? amount / rate : amount;
  }

  public fromUSD(amountInUSD: number, toCurrency: string): number {
    if (!amountInUSD || isNaN(amountInUSD)) return 0;
    const code = (toCurrency || 'USD').toUpperCase().trim();
    if (code === 'USD') return amountInUSD;
    const rate = this.getRateToUSD(code);
    return rate > 0 ? amountInUSD * rate : amountInUSD;
  }

  public convert(amount: number, fromCurrency: string, toCurrency: string): number {
    if (!amount || isNaN(amount)) return 0;
    const fromCode = (fromCurrency || 'USD').toUpperCase().trim();
    const toCode = (toCurrency || 'USD').toUpperCase().trim();
    if (fromCode === toCode) return amount;
    const inUSD = this.toUSD(amount, fromCode);
    return this.fromUSD(inUSD, toCode);
  }
}
