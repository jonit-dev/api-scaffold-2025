import { IsString, IsOptional, IsNumber, IsIn, Min } from "class-validator";

export class RefundPaymentDto {
  @IsString()
  paymentIntentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsIn(["duplicate", "fraudulent", "requested_by_customer"])
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}
