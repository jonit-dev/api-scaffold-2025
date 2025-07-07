import { PaymentStatus } from "../../types/stripe.types";

export interface IPaymentFilters {
  userId?: string;
  status?: PaymentStatus;
  stripeCustomerId?: string;
  currency?: string;
  amountMin?: number;
  amountMax?: number;
  search?: string;
}
