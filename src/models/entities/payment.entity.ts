import { IBaseEntity } from "../../types/database.types";
import { PaymentStatus } from "../../types/stripe.types";

export interface IPaymentEntity extends IBaseEntity {
  stripe_payment_intent_id: string;
  user_id: string;
  stripe_customer_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  processed_at?: string;
}
