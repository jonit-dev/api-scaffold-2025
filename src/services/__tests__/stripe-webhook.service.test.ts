import { describe, it, expect, beforeEach, vi } from "vitest";
import { StripeWebhookService } from "../stripe-webhook.service";
import { StripeService } from "../stripe.service";
import { StripeCustomerService } from "../stripe-customer.service";
import { StripeWebhookException } from "../../exceptions/stripe.exception";
import { StripeWebhookEventType } from "../../types/stripe.types";

// Mock dependencies
const mockStripeService = {
  getStripeInstance: vi.fn(),
} as any;

const mockCustomerService = {} as any;

const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
    generateTestHeaderString: vi.fn(),
  },
  events: {
    retrieve: vi.fn(),
    list: vi.fn(),
  },
} as any;

// Mock config
vi.mock("../../config/env", () => ({
  config: {
    webhook: {
      stripeEndpointSecret: "whsec_test_12345",
    },
  },
}));

describe("StripeWebhookService", () => {
  let webhookService: StripeWebhookService;

  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeService.getStripeInstance.mockReturnValue(mockStripe);
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      logStripeEvent: vi.fn(),
      logError: vi.fn(),
    } as any;
    webhookService = new StripeWebhookService(
      mockStripeService,
      mockCustomerService,
      mockLogger,
    );
  });

  describe("processWebhook", () => {
    it("should process a valid webhook successfully", async () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = "test_signature";
      const mockEvent = {
        id: "evt_123",
        type: StripeWebhookEventType.PAYMENT_INTENT_SUCCEEDED,
        data: {
          object: {
            id: "pi_123",
            customer: "cus_123",
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock console.log to avoid output during tests
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await webhookService.processWebhook(payload, signature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        "whsec_test_12345",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Webhook event received: payment_intent.succeeded (evt_123)",
      );
      expect(mockLogger.logStripeEvent).toHaveBeenCalledWith(
        "payment_intent.succeeded",
        "evt_123",
        true,
      );

      consoleSpy.mockRestore();
    });

    it("should throw StripeWebhookException for invalid signature", async () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = "invalid_signature";

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      await expect(
        webhookService.processWebhook(payload, signature),
      ).rejects.toThrow(StripeWebhookException);
    });

    it("should skip processing if event already processed", async () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = "test_signature";
      const mockEvent = {
        id: "evt_123",
        type: StripeWebhookEventType.PAYMENT_INTENT_SUCCEEDED,
        data: {
          object: {
            id: "pi_123",
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Process the event once
      await webhookService.processWebhook(payload, signature);

      // Mock console.log to check for skip message
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Process the same event again
      await webhookService.processWebhook(payload, signature);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Event evt_123 already processed, skipping",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("verifyWebhookSignature", () => {
    it("should return true for valid signature", async () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = "valid_signature";

      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_123",
        type: "test.event",
      });

      const result = await webhookService.verifyWebhookSignature(
        payload,
        signature,
      );

      expect(result).toBe(true);
    });

    it("should return false for invalid signature", async () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = "invalid_signature";

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const result = await webhookService.verifyWebhookSignature(
        payload,
        signature,
      );

      expect(result).toBe(false);
    });
  });

  describe("getWebhookEvent", () => {
    it("should retrieve webhook event successfully", async () => {
      const eventId = "evt_123";
      const mockEvent = {
        id: eventId,
        type: "payment_intent.succeeded",
        data: {},
      };

      mockStripe.events.retrieve.mockResolvedValue(mockEvent);

      const result = await webhookService.getWebhookEvent(eventId);

      expect(result).toEqual(mockEvent);
      expect(mockStripe.events.retrieve).toHaveBeenCalledWith(eventId);
    });
  });

  describe("listWebhookEvents", () => {
    it("should list webhook events successfully", async () => {
      const mockEvents = [
        { id: "evt_123", type: "payment_intent.succeeded" },
        { id: "evt_456", type: "customer.created" },
      ];

      mockStripe.events.list.mockResolvedValue({
        data: mockEvents,
      });

      const result = await webhookService.listWebhookEvents(10);

      expect(result).toEqual(mockEvents);
      expect(mockStripe.events.list).toHaveBeenCalledWith({
        limit: 10,
        starting_after: undefined,
      });
    });
  });

  describe("generateTestEvent", () => {
    it("should generate test event payload", () => {
      const eventType = "test.event";
      const data = { id: "test_123" };

      const result = webhookService.generateTestEvent(eventType, data);

      const parsed = JSON.parse(result);
      expect(parsed.type).toBe(eventType);
      expect(parsed.data.object).toEqual(data);
      expect(parsed.object).toBe("event");
    });
  });

  describe("generateTestHeaderString", () => {
    it("should generate test header string", () => {
      const payload = '{"test": "data"}';
      const mockHeader = "t=123,v1=signature";

      mockStripe.webhooks.generateTestHeaderString.mockReturnValue(mockHeader);

      const result = webhookService.generateTestHeaderString(payload);

      expect(result).toBe(mockHeader);
      expect(mockStripe.webhooks.generateTestHeaderString).toHaveBeenCalledWith(
        {
          payload,
          secret: "whsec_test_12345",
        },
      );
    });
  });

  describe("event handling", () => {
    it("should handle payment_intent.succeeded event", async () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = "test_signature";
      const mockEvent = {
        id: "evt_123",
        type: StripeWebhookEventType.PAYMENT_INTENT_SUCCEEDED,
        data: {
          object: {
            id: "pi_123",
            customer: "cus_123",
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await webhookService.processWebhook(payload, signature);

      expect(mockLogger.info).toHaveBeenCalledWith("Payment succeeded: pi_123");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Payment successful for customer: cus_123",
      );
    });

    it("should handle unhandled event types", async () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = "test_signature";
      const mockEvent = {
        id: "evt_123",
        type: "unknown.event.type",
        data: {
          object: {},
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await webhookService.processWebhook(payload, signature);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Unhandled webhook event type: unknown.event.type",
      );
    });
  });
});
