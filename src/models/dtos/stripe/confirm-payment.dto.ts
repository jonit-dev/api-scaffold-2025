import { IsString, IsOptional, IsUrl } from "class-validator";

export class ConfirmPaymentDto {
  @IsString()
  paymentIntentId!: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}
