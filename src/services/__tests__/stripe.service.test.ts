import { describe, it, expect, beforeEach, vi } from "vitest";
import { StripeService } from "../stripe.service";
import { config } from "../../config/env";

// Mock the config module
vi.mock("../../config/env", () => ({
  config: {
    stripe: {
      secretKey: "sk_test_12345",
      publishableKey: "pk_test_12345",
      webhookSecret: "whsec_test_12345",
      apiVersion: "2023-10-16",
    },
  },
}));

// Mock Stripe
const mockStripeConstructor = vi.fn();
const mockAccountsRetrieve = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => {
      mockStripeConstructor();
      return {
        accounts: {
          retrieve: mockAccountsRetrieve,
        },
      };
    }),
  };
});

describe("StripeService", () => {
  let stripeService: StripeService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure config is properly mocked
    config.stripe.secretKey = "sk_test_12345";
    config.stripe.publishableKey = "pk_test_12345";
    config.stripe.webhookSecret = "whsec_test_12345";
    const mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as any;
    stripeService = new StripeService(mockLogger);
  });

  describe("constructor", () => {
    it("should initialize Stripe with correct configuration", () => {
      expect(mockStripeConstructor).toHaveBeenCalled();
    });

    it("should throw error when required environment variables are missing", () => {
      const originalConfig = { ...config };

      config.stripe.secretKey = "sk_test_default";

      const mockLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      } as any;
      expect(() => new StripeService(mockLogger)).toThrow(
        "Missing required Stripe environment variables: STRIPE_SECRET_KEY",
      );

      // Restore original config
      Object.assign(config, originalConfig);
    });
  });

  describe("getStripeInstance", () => {
    it("should return the Stripe instance", () => {
      const instance = stripeService.getStripeInstance();
      expect(instance).toBeDefined();
      expect(instance.accounts).toBeDefined();
    });
  });

  describe("testConnection", () => {
    it("should return true when connection is successful", async () => {
      mockAccountsRetrieve.mockResolvedValue({ id: "acct_123" });

      const result = await stripeService.testConnection();

      expect(result).toBe(true);
      expect(mockAccountsRetrieve).toHaveBeenCalled();
    });

    it("should return false when connection fails", async () => {
      mockAccountsRetrieve.mockRejectedValue(new Error("Connection failed"));

      const result = await stripeService.testConnection();

      expect(result).toBe(false);
      expect(mockAccountsRetrieve).toHaveBeenCalled();
    });
  });
});
