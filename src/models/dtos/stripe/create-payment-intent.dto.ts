import { IsNumber, IsString, IsOptional, Min, IsIn } from "class-validator";

export class CreatePaymentIntentDto {
  @IsNumber()
  @Min(50) // Minimum amount in cents (50 cents)
  amount!: number;

  @IsString()
  @IsIn(["usd", "eur", "gbp", "cad", "aud"])
  currency!: string;

  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsIn(["automatic", "manual"])
  captureMethod?: "automatic" | "manual";

  @IsOptional()
  @IsString()
  description?: string;
}
