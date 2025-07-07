import { SubscriptionStatus } from "../../types/stripe.types";

export interface ISubscriptionFilters {
  userId?: string;
  status?: SubscriptionStatus;
  stripeCustomerId?: string;
  productId?: string;
  priceId?: string;
  search?: string;
}
