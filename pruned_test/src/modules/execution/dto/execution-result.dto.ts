import { IsString, IsNotEmpty, IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class ExecutionResultDto {
  @IsString()
  @IsNotEmpty()
  commandId: string;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsNumber()
  retcode?: number;

  @IsOptional()
  @IsString()
  retcodeDescription?: string;

  @IsOptional()
  @IsString()
  orderTicket?: string;

  @IsOptional()
  @IsString()
  dealTicket?: string;

  @IsOptional()
  @IsNumber()
  executedVolume?: number;

  @IsOptional()
  @IsNumber()
  executedPrice?: number;

  @IsOptional()
  @IsNumber()
  requestedPrice?: number;

  @IsOptional()
  @IsNumber()
  sl?: number;

  @IsOptional()
  @IsNumber()
  tp?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  brokerError?: string;

  @IsString()
  timestamp: string;

  @IsOptional()
  @IsNumber()
  subReceivedAt?: number;

  @IsOptional()
  @IsNumber()
  subAcknowledgedAt?: number;

  @IsOptional()
  @IsNumber()
  subExecutionStartedAt?: number;

  @IsOptional()
  @IsNumber()
  subExecutionCompletedAt?: number;
}
