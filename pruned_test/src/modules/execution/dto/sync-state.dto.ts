export class SyncStateDto {
  balance: number;
  equity: number;
  marginFree: number;
  
  positions: Array<{
    ticket: string;
    symbol: string;
    type: string;
    volume: number;
    priceOpen: number;
    sl: number;
    tp: number;
    identifier?: string;
  }>;
  
  orders: Array<{
    ticket: string;
    symbol: string;
    type: string;
    volume: number;
    price: number;
    sl: number;
    tp: number;
  }>;
}
