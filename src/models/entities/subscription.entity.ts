import { IBaseEntity } from "../../types/database.types";
import { SubscriptionStatus } from "../../types/stripe.types";

export interface ISubscriptionEntity extends IBaseEntity {
  stripe_subscription_id: string;
  user_id: string;
  stripe_customer_id: string;
  product_id: string;
  price_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  trial_start?: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}
