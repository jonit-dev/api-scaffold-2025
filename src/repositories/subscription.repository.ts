import { Service } from "typedi";
import { ISubscriptionEntity } from "../models/entities/subscription.entity";
import { BaseRepository } from "./base.repository";
import { SubscriptionStatus } from "../types/stripe.types";
import { DatabaseException } from "../exceptions/database.exception";

@Service()
export class SubscriptionRepository extends BaseRepository<ISubscriptionEntity> {
  protected tableName = "subscriptions";

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ISubscriptionEntity | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .eq("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseException(error.message);
    }

    return data;
  }

  async findByUserId(userId: string): Promise<ISubscriptionEntity[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async findActiveByUserId(
    userId: string,
  ): Promise<ISubscriptionEntity | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .eq("status", SubscriptionStatus.ACTIVE)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false })
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseException(error.message);
    }

    return data;
  }

  async findByStatus(
    status: SubscriptionStatus,
    limit = 50,
  ): Promise<ISubscriptionEntity[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("status", status)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async updateStatus(
    id: string,
    status: SubscriptionStatus,
    canceledAt?: Date,
  ): Promise<ISubscriptionEntity> {
    const updateData: Partial<ISubscriptionEntity> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (canceledAt && status === SubscriptionStatus.CANCELED) {
      updateData.canceled_at = canceledAt.toISOString();
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new DatabaseException(error.message);
    }

    if (!data) {
      throw new DatabaseException(
        `Subscription with ID ${id} not found after update`,
      );
    }

    return data;
  }

  async findExpiringTrials(daysFromNow = 3): Promise<ISubscriptionEntity[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("status", SubscriptionStatus.TRIALING)
      .lte("trial_end", expiryDate.toISOString())
      .gt("trial_end", new Date().toISOString())
      .eq("deleted_at", null)
      .order("trial_end", { ascending: true });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async findUpcomingRenewals(daysFromNow = 3): Promise<ISubscriptionEntity[]> {
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + daysFromNow);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("status", SubscriptionStatus.ACTIVE)
      .lte("current_period_end", renewalDate.toISOString())
      .gt("current_period_end", new Date().toISOString())
      .eq("cancel_at_period_end", false)
      .eq("deleted_at", null)
      .order("current_period_end", { ascending: true });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }
}
