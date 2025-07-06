import { Service } from "typedi";
import { IPaymentEntity } from "../models/entities/payment.entity";
import { BaseRepository } from "./base.repository";
import { PaymentStatus } from "../types/stripe.types";

export interface IPaymentFilter {
  userId?: string;
  stripeCustomerId?: string;
  status?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
}

@Service()
export class PaymentRepository extends BaseRepository<IPaymentEntity> {
  protected tableName = "payments";

  constructor() {
    super();
  }

  async findByStripePaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<IPaymentEntity | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("stripe_payment_intent_id", stripePaymentIntentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error finding payment: ${error.message}`);
    }

    return data;
  }

  async findByUserId(
    userId: string,
    limit?: number,
  ): Promise<IPaymentEntity[]> {
    let query = this.supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error finding payments by user: ${error.message}`);
    }

    return data || [];
  }

  async findByFilter(
    filter: IPaymentFilter,
    limit = 50,
    offset = 0,
  ): Promise<IPaymentEntity[]> {
    let query = this.supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter.userId) {
      query = query.eq("user_id", filter.userId);
    }

    if (filter.stripeCustomerId) {
      query = query.eq("stripe_customer_id", filter.stripeCustomerId);
    }

    if (filter.status) {
      query = query.eq("status", filter.status);
    }

    if (filter.startDate) {
      query = query.gte("created_at", filter.startDate.toISOString());
    }

    if (filter.endDate) {
      query = query.lte("created_at", filter.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error finding payments with filter: ${error.message}`);
    }

    return data || [];
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    processedAt?: Date,
  ): Promise<IPaymentEntity> {
    const updateData: Partial<IPaymentEntity> = { status };
    if (processedAt) {
      updateData.processed_at = processedAt.toISOString();
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error updating payment status: ${error.message}`);
    }

    return data;
  }

  async getTotalAmountByUser(
    userId: string,
    status?: PaymentStatus,
  ): Promise<number> {
    let query = this.supabase
      .from(this.tableName)
      .select("amount")
      .eq("user_id", userId);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error calculating total amount: ${error.message}`);
    }

    return (data || []).reduce((total, payment) => total + payment.amount, 0);
  }
}
