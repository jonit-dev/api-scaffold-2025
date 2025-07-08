import { describe, it, expect, beforeEach, vi } from "vitest";
import { StripeService } from "../stripe.service";

// Create a simple mock that focuses on the essential functionality
const mockAccountsRetrieve = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      accounts: {
        retrieve: mockAccountsRetrieve,
      },
    })),
  };
});

// Mock the config module
const mockConfig = {
  stripe: {
    secretKey: "sk_test_12345",
    publishableKey: "pk_test_12345",
    webhookSecret: "whsec_test_12345",
    apiVersion: "2023-10-16" as const,
  },
};

vi.mock("../../config/env", () => ({
  config: mockConfig,
}));

describe("StripeService", () => {
  let stripeService: StripeService;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.stripe.secretKey = "sk_test_12345";
    mockConfig.stripe.publishableKey = "pk_test_12345";
    mockConfig.stripe.webhookSecret = "whsec_test_12345";

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe("constructor", () => {
    it("should initialize successfully with valid configuration", () => {
      expect(() => {
        stripeService = new StripeService(mockLogger);
      }).not.toThrow();
    });

    it("should throw error when required environment variables are missing", async () => {
      // Temporarily change the mock config
      const originalSecretKey = mockConfig.stripe.secretKey;
      mockConfig.stripe.secretKey = "sk_test_default";

      // Need to re-import the module to get the new config
      vi.resetModules();
      const { StripeService: FreshStripeService } = await import(
        "../stripe.service"
      );

      expect(() => new FreshStripeService(mockLogger)).toThrow(
        "Missing required Stripe environment variables: STRIPE_SECRET_KEY",
      );

      // Restore original config
      mockConfig.stripe.secretKey = originalSecretKey;
    });
  });

  describe("getStripeInstance", () => {
    it("should return the Stripe instance", () => {
      stripeService = new StripeService(mockLogger);
      const instance = stripeService.getStripeInstance();
      expect(instance).toBeDefined();
      expect(instance.accounts).toBeDefined();
    });
  });

  describe("testConnection", () => {
    it("should return true when connection is successful", async () => {
      stripeService = new StripeService(mockLogger);
      // The mock needs to be set up before calling the method
      const stripeInstance = stripeService.getStripeInstance();
      stripeInstance.accounts.retrieve = mockAccountsRetrieve;
      mockAccountsRetrieve.mockResolvedValue({ id: "acct_123" });

      const result = await stripeService.testConnection();

      expect(result).toBe(true);
      expect(mockAccountsRetrieve).toHaveBeenCalled();
    });

    it("should return false when connection fails", async () => {
      stripeService = new StripeService(mockLogger);
      // The mock needs to be set up before calling the method
      const stripeInstance = stripeService.getStripeInstance();
      stripeInstance.accounts.retrieve = mockAccountsRetrieve;
      mockAccountsRetrieve.mockRejectedValue(new Error("Connection failed"));

      const result = await stripeService.testConnection();

      expect(result).toBe(false);
      expect(mockAccountsRetrieve).toHaveBeenCalled();
    });
  });
});
