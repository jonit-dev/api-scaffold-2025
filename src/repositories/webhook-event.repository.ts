import { Service } from "typedi";
import { IWebhookEventEntity } from "../models/entities/webhook-event.entity";
import { BaseRepository } from "./base.repository";
import { DatabaseException } from "../exceptions/database.exception";

@Service()
export class WebhookEventRepository extends BaseRepository<IWebhookEventEntity> {
  protected tableName = "webhook_events";

  protected initializeTable(): void {
    // Webhook event table initialization would be implemented here for SQLite
    // For now, empty implementation since we're primarily using Supabase
  }

  async findByStripeEventId(
    stripeEventId: string,
  ): Promise<IWebhookEventEntity | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("stripe_event_id", stripeEventId)
      .eq("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseException(error.message);
    }

    return data;
  }

  async findUnprocessed(limit = 50): Promise<IWebhookEventEntity[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("processed", false)
      .eq("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async findByEventType(
    eventType: string,
    limit = 50,
  ): Promise<IWebhookEventEntity[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("event_type", eventType)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async markAsProcessed(id: string): Promise<IWebhookEventEntity> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new DatabaseException(error.message);
    }

    if (!data) {
      throw new DatabaseException(
        `Webhook event with ID ${id} not found after update`,
      );
    }

    return data;
  }

  async markAsFailed(id: string, error: string): Promise<IWebhookEventEntity> {
    const webhookEvent = await this.findById(id);
    if (!webhookEvent) {
      throw new DatabaseException(`Webhook event with ID ${id} not found`);
    }

    const { data, error: updateError } = await this.supabase
      .from(this.tableName)
      .update({
        processing_error: error,
        retry_count: webhookEvent.retry_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw new DatabaseException(updateError.message);
    }

    if (!data) {
      throw new DatabaseException(
        `Webhook event with ID ${id} not found after update`,
      );
    }

    return data;
  }

  async findFailedEvents(maxRetries = 3): Promise<IWebhookEventEntity[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("processed", false)
      .lte("retry_count", maxRetries)
      .eq("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async cleanupOldEvents(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { count, error } = await this.supabase
      .from(this.tableName)
      .delete({ count: "exact" })
      .eq("processed", true)
      .lt("created_at", cutoffDate.toISOString());

    if (error) {
      throw new DatabaseException(error.message);
    }

    return count || 0;
  }
}
