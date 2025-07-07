import { Service } from "typedi";
import { IWebhookEventEntity } from "../models/entities/webhook-event.entity";
import { BaseRepository } from "./base.repository";

@Service()
export class WebhookEventRepository extends BaseRepository<IWebhookEventEntity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getModel(): any {
    return this.prisma.webhookEvent;
  }

  async findByStripeEventId(
    stripeEventId: string,
  ): Promise<IWebhookEventEntity | null> {
    return await this.prisma.webhookEvent.findFirst({
      where: {
        stripeEventId,
        deletedAt: null,
      },
    });
  }

  async findUnprocessed(limit = 50): Promise<IWebhookEventEntity[]> {
    return await this.prisma.webhookEvent.findMany({
      where: {
        processed: false,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async findByEventType(
    eventType: string,
    limit = 50,
  ): Promise<IWebhookEventEntity[]> {
    return await this.prisma.webhookEvent.findMany({
      where: {
        eventType,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async markAsProcessed(id: string): Promise<IWebhookEventEntity> {
    return await this.prisma.webhookEvent.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });
  }

  async markAsFailed(id: string, error: string): Promise<IWebhookEventEntity> {
    const webhookEvent = await this.findById(id);
    if (!webhookEvent) {
      throw new Error(`Webhook event with ID ${id} not found`);
    }

    return await this.prisma.webhookEvent.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        processingError: error,
        retryCount: webhookEvent.retryCount + 1,
      },
    });
  }

  async findFailedEvents(maxRetries = 3): Promise<IWebhookEventEntity[]> {
    return await this.prisma.webhookEvent.findMany({
      where: {
        processed: false,
        retryCount: {
          lte: maxRetries,
        },
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async cleanupOldEvents(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { count } = await this.prisma.webhookEvent.deleteMany({
      where: {
        processed: true,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return count;
  }
}
