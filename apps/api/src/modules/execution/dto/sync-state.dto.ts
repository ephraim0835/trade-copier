import { IsNumber, IsArray, ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PositionSyncDto {
  @IsString()
  ticket: string;

  @IsString()
  symbol: string;

  @IsString()
  type: string;

  @IsNumber()
  volume: number;

  @IsNumber()
  priceOpen: number;

  @IsNumber()
  sl: number;

  @IsNumber()
  tp: number;

  @IsOptional()
  @IsString()
  identifier?: string;
}

export class OrderSyncDto {
  @IsString()
  ticket: string;

  @IsString()
  symbol: string;

  @IsString()
  type: string;

  @IsNumber()
  volume: number;

  @IsNumber()
  price: number;

  @IsNumber()
  sl: number;

  @IsNumber()
  tp: number;
}

export class SyncStateDto {
  @IsOptional()
  @IsNumber()
  balance?: number;

  @IsOptional()
  @IsNumber()
  equity?: number;

  @IsOptional()
  @IsNumber()
  marginFree?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionSyncDto)
  positions?: PositionSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderSyncDto)
  orders?: OrderSyncDto[];
}
