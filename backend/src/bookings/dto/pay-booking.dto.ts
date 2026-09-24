import { IsIn, IsString, MinLength } from 'class-validator';

export class PayBookingDto {
  @IsString()
  @MinLength(6)
  idempotencyKey!: string;

  @IsIn(['success', 'fail'])
  simulate!: 'success' | 'fail';
}
