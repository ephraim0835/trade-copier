import { IsString, IsNumber, IsOptional, IsInt, Min } from 'class-validator';

export class MasterSignalDto {
  @IsString()
  ticket!: string;

  @IsString()
  symbol!: string;

  @IsString()
  type!: 'BUY' | 'SELL' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';

  @IsNumber()
  @Min(0)
  volume!: number;

  @IsNumber()
  priceOpen!: number;

  @IsNumber()
  @IsOptional()
  sl?: number;

  @IsNumber()
  @IsOptional()
  tp?: number;

  @IsInt()
  sequenceNumber!: number;

  @IsNumber()
  @IsOptional()
  masterEventDetectedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventQueuedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventSentAt?: number;
}

export class MasterModifyDto {
  @IsString()
  ticket!: string;

  @IsNumber()
  @IsOptional()
  priceOpen?: number;

  @IsNumber()
  @IsOptional()
  sl?: number;

  @IsNumber()
  @IsOptional()
  tp?: number;

  @IsInt()
  sequenceNumber!: number;

  @IsNumber()
  @IsOptional()
  masterEventDetectedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventQueuedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventSentAt?: number;
}

export class MasterCloseDto {
  @IsString()
  ticket!: string;

  @IsNumber()
  @IsOptional()
  volume?: number; // if omitted, means full close

  @IsInt()
  sequenceNumber!: number;

  @IsNumber()
  @IsOptional()
  masterEventDetectedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventQueuedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventSentAt?: number;
}

export class MasterTriggerDto {
  @IsString()
  orderTicket!: string; // Original pending order ticket

  @IsString()
  positionTicket!: string; // New position ticket

  @IsInt()
  sequenceNumber!: number;

  @IsNumber()
  @IsOptional()
  masterEventDetectedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventQueuedAt?: number;

  @IsNumber()
  @IsOptional()
  masterEventSentAt?: number;
}
