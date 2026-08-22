import { IsNumber, IsString, IsOptional } from 'class-validator';

export class UpdateTelemetryDto {
  @IsNumber()
  @IsOptional()
  balance?: number;

  @IsNumber()
  @IsOptional()
  equity?: number;

  @IsNumber()
  @IsOptional()
  margin?: number;

  @IsNumber()
  @IsOptional()
  freeMargin?: number;

  @IsNumber()
  @IsOptional()
  floatingPl?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
