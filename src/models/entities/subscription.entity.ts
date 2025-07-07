import { IBaseEntity } from "../../types/database.types";
import { SubscriptionStatus } from "../../types/stripe.types";

export interface ISubscriptionEntity extends IBaseEntity {
  stripeSubscriptionId: string;
  userId: string;
  stripeCustomerId: string;
  productId: string;
  priceId: string;
  status: SubscriptionStatus | string;
  currentPeriodStart: Date | string;
  currentPeriodEnd: Date | string;
  trialStart?: Date | string | null;
  trialEnd?: Date | string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | string | null;
  quantity: number;
  metadata?: unknown;
}
