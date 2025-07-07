import { IBaseEntity } from "../../types/database.types";
import { PaymentStatus } from "../../types/stripe.types";

export interface IPaymentEntity extends IBaseEntity {
  stripePaymentIntentId: string;
  userId: string;
  stripeCustomerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  paymentMethod?: string | null;
  description?: string | null;
  metadata?: unknown;
  processedAt?: Date | string | null;
}
