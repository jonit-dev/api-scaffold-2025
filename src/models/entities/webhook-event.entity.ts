import { IBaseEntity } from "../../types/database.types";

export interface IWebhookEventEntity extends IBaseEntity {
  stripe_event_id: string;
  event_type: string;
  processed: boolean;
  processed_at?: string;
  payload: unknown;
  processing_error?: string;
  retry_count: number;
}
