import { z } from 'zod';

// Shared Data Transfer Objects and Zod schemas

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const EaAuthDtoSchema = z.object({
  token: z.string(),
});
export type EaAuthDto = z.infer<typeof EaAuthDtoSchema>;

export const TradeSignalDtoSchema = z.object({
  ticket: z.number(),
  symbol: z.string(),
  type: z.enum(['BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP']),
  volume: z.number(),
  price: z.number(),
  time: z.number(), // Unix timestamp
});
export type TradeSignalDto = z.infer<typeof TradeSignalDtoSchema>;
