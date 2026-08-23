export class CommandDto {
  commandId!: string;
  tradeCopyId!: string;
  type!: string;
  masterSignalId?: string;
  masterOrderTicket?: string;
  masterPositionTicket?: string;
  subPositionTicket?: string;
  
  symbol: string;
  orderType: string;
  direction?: string;
  volume: number;
  intendedRisk?: number;
  price?: number;
  sl?: number;
  tp?: number;
  magicNumber?: string;
  
  expiresAt: string;
}
