import { IsOptional, IsInt, Min, IsNumber, IsBoolean, Max, IsString, Allow } from 'class-validator';

export class UpdateCopySettingsDto {
  @IsOptional()
  @Allow()
  displayName?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(10.0)
  riskMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  roundingTolerancePct?: number;

  @IsOptional()
  @IsBoolean()
  dailyRiskEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDailyRisk?: number;

  @IsOptional()
  @IsBoolean()
  maxTradesEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxActiveTrades?: number;

  @IsOptional()
  @IsBoolean()
  requireTp?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  missingSlTimeoutSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRecoveryRRDegradation?: number;
}
