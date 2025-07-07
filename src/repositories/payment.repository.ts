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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getModel(): any {
    return this.prisma.payment;
  }

  async findByStripePaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<IPaymentEntity | null> {
    return await this.prisma.payment.findFirst({
      where: {
        stripePaymentIntentId,
        deletedAt: null,
      },
    });
  }

  async findByUserId(
    userId: string,
    limit?: number,
  ): Promise<IPaymentEntity[]> {
    return await this.prisma.payment.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async findByFilter(
    filter: IPaymentFilter,
    limit = 50,
    offset = 0,
  ): Promise<IPaymentEntity[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      deletedAt: null,
    };

    if (filter.userId) {
      where.userId = filter.userId;
    }
    if (filter.stripeCustomerId) {
      where.stripeCustomerId = filter.stripeCustomerId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.startDate) {
      where.createdAt = { gte: filter.startDate };
    }
    if (filter.endDate) {
      where.createdAt = {
        ...(where.createdAt as object),
        lte: filter.endDate,
      };
    }

    return await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    processedAt?: Date,
  ): Promise<IPaymentEntity> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { status };
    if (processedAt) {
      data.processedAt = processedAt;
    }

    return await this.prisma.payment.update({
      where: {
        id,
        deletedAt: null,
      },
      data,
    });
  }

  async getTotalAmountByUser(
    userId: string,
    status?: PaymentStatus,
  ): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    const payments = await this.prisma.payment.findMany({
      where,
      select: { amount: true },
    });

    return payments.reduce((total, payment) => total + payment.amount, 0);
  }
}
