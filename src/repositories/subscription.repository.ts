import { Service } from "typedi";
import { ISubscriptionEntity } from "../models/entities/subscription.entity";
import { BaseRepository } from "./base.repository";
import { SubscriptionStatus } from "../types/stripe.types";

@Service()
export class SubscriptionRepository extends BaseRepository<ISubscriptionEntity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getModel(): any {
    return this.prisma.subscription;
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ISubscriptionEntity | null> {
    return await this.prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId,
        deletedAt: null,
      },
    });
  }

  async findByUserId(userId: string): Promise<ISubscriptionEntity[]> {
    return await this.prisma.subscription.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findActiveByUserId(
    userId: string,
  ): Promise<ISubscriptionEntity | null> {
    return await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.Active,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByStatus(
    status: SubscriptionStatus,
    limit = 50,
  ): Promise<ISubscriptionEntity[]> {
    return await this.prisma.subscription.findMany({
      where: {
        status,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async updateStatus(
    id: string,
    status: SubscriptionStatus,
    canceledAt?: Date,
  ): Promise<ISubscriptionEntity> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { status };

    if (canceledAt && status === SubscriptionStatus.Canceled) {
      data.canceledAt = canceledAt;
    }

    return await this.prisma.subscription.update({
      where: {
        id,
        deletedAt: null,
      },
      data,
    });
  }

  async findExpiringTrials(daysFromNow = 3): Promise<ISubscriptionEntity[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    return await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.Trialing,
        trialEnd: {
          lte: expiryDate,
          gt: new Date(),
        },
        deletedAt: null,
      },
      orderBy: { trialEnd: "asc" },
    });
  }

  async findUpcomingRenewals(daysFromNow = 3): Promise<ISubscriptionEntity[]> {
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + daysFromNow);

    return await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.Active,
        currentPeriodEnd: {
          lte: renewalDate,
          gt: new Date(),
        },
        cancelAtPeriodEnd: false,
        deletedAt: null,
      },
      orderBy: { currentPeriodEnd: "asc" },
    });
  }
}
