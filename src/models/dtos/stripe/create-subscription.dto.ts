import { IsString, IsOptional, IsNumber, IsIn, Min } from "class-validator";

export class CreateSubscriptionDto {
  @IsString()
  customerId!: string;

  @IsString()
  priceId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  trialPeriodDays?: number;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsIn(["create_prorations", "none", "always_invoice"])
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
}
