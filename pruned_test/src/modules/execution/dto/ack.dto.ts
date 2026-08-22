import { IsString, IsNotEmpty } from 'class-validator';

export class AckDto {
  @IsString()
  @IsNotEmpty()
  commandId: string;
}
