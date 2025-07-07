import { IBaseEntity } from "../../types/database.types";

export interface IWebhookEventEntity extends IBaseEntity {
  stripeEventId: string;
  eventType: string;
  processed: boolean;
  processedAt?: Date | string | null;
  payload: unknown;
  processingError?: string | null;
  retryCount: number;
}
