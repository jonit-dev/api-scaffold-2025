import { describe, it, expect, beforeEach, vi } from "vitest";
import { StripeCustomerService } from "../stripe-customer.service";
import { StripeService } from "../stripe.service";
import { UserService } from "../user.service";
import { StripeCustomerException } from "../../exceptions/stripe.exception";
import { NotFoundException } from "../../exceptions/http-exceptions";
import Stripe from "stripe";

// Mock dependencies
const mockStripeService = {
  getStripeInstance: vi.fn(),
} as any;

const mockUserService = {
  findById: vi.fn(),
  update: vi.fn(),
} as any;

const mockStripe = {
  customers: {
    create: vi.fn(),
    update: vi.fn(),
    retrieve: vi.fn(),
    list: vi.fn(),
    del: vi.fn(),
  },
  paymentMethods: {
    attach: vi.fn(),
    detach: vi.fn(),
    list: vi.fn(),
  },
} as any;

describe("StripeCustomerService", () => {
  let customerService: StripeCustomerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeService.getStripeInstance.mockReturnValue(mockStripe);
    customerService = new StripeCustomerService(
      mockStripeService,
      mockUserService,
    );
  });

  describe("createCustomer", () => {
    it("should create a customer successfully", async () => {
      const customerData = {
        email: "test@example.com",
        name: "Test User",
        phone: "+1234567890",
      };

      const mockCustomer = {
        id: "cus_123",
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const result = await customerService.createCustomer(customerData);

      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        description: undefined,
        metadata: {
          created_by: "api-scaffold",
        },
      });
    });

    it("should handle Stripe errors", async () => {
      const customerData = {
        email: "test@example.com",
        name: "Test User",
      };

      const stripeError = {
        type: "invalid_request_error" as const,
        message: "Invalid email",
        code: undefined,
        decline_code: undefined,
        param: undefined,
      } as Stripe.StripeRawError;
      mockStripe.customers.create.mockRejectedValue(stripeError);

      await expect(
        customerService.createCustomer(customerData),
      ).rejects.toThrow();
    });
  });

  describe("updateCustomer", () => {
    it("should update a customer successfully", async () => {
      const customerId = "cus_123";
      const updateData = {
        name: "Updated Name",
        email: "updated@example.com",
      };

      const mockUpdatedCustomer = {
        id: customerId,
        name: updateData.name,
        email: updateData.email,
      };

      mockStripe.customers.update.mockResolvedValue(mockUpdatedCustomer);

      const result = await customerService.updateCustomer(
        customerId,
        updateData,
      );

      expect(result).toEqual(mockUpdatedCustomer);
      expect(mockStripe.customers.update).toHaveBeenCalledWith(customerId, {
        email: updateData.email,
        name: updateData.name,
        phone: undefined,
        description: undefined,
        metadata: undefined,
      });
    });
  });

  describe("getCustomer", () => {
    it("should retrieve a customer successfully", async () => {
      const customerId = "cus_123";
      const mockCustomer = {
        id: customerId,
        email: "test@example.com",
        deleted: false,
      };

      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      const result = await customerService.getCustomer(customerId);

      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith(customerId);
    });

    it("should throw NotFoundException for deleted customer", async () => {
      const customerId = "cus_123";
      const mockDeletedCustomer = {
        id: customerId,
        deleted: true,
      };

      mockStripe.customers.retrieve.mockResolvedValue(mockDeletedCustomer);

      await expect(customerService.getCustomer(customerId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getCustomerByEmail", () => {
    it("should find customer by email", async () => {
      const email = "test@example.com";
      const mockCustomer = {
        id: "cus_123",
        email,
      };

      mockStripe.customers.list.mockResolvedValue({
        data: [mockCustomer],
      });

      const result = await customerService.getCustomerByEmail(email);

      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email,
        limit: 1,
      });
    });

    it("should return null when customer not found", async () => {
      const email = "nonexistent@example.com";

      mockStripe.customers.list.mockResolvedValue({
        data: [],
      });

      const result = await customerService.getCustomerByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe("deleteCustomer", () => {
    it("should delete a customer successfully", async () => {
      const customerId = "cus_123";
      const mockDeletedCustomer = {
        id: customerId,
        deleted: true,
      };

      mockStripe.customers.del.mockResolvedValue(mockDeletedCustomer);

      const result = await customerService.deleteCustomer(customerId);

      expect(result).toEqual(mockDeletedCustomer);
      expect(mockStripe.customers.del).toHaveBeenCalledWith(customerId);
    });
  });

  describe("syncCustomerWithUser", () => {
    it("should create new customer when user has no Stripe customer ID", async () => {
      const userId = "user_123";
      const mockUser = {
        id: userId,
        email: "test@example.com",
        full_name: "Test User",
        stripe_customer_id: null,
      };

      const mockCustomer = {
        id: "cus_123",
        email: mockUser.email,
        name: mockUser.full_name,
      };

      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripe.customers.create.mockResolvedValue(mockCustomer);
      mockUserService.update.mockResolvedValue(mockUser);

      const result = await customerService.syncCustomerWithUser(userId);

      expect(result).toEqual(mockCustomer);
      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        name: mockUser.full_name,
        phone: undefined,
        description: undefined,
        metadata: {
          user_id: userId,
          created_by: "api-scaffold",
        },
      });
      expect(mockUserService.update).toHaveBeenCalledWith(userId, {
        stripe_customer_id: mockCustomer.id,
      });
    });

    it("should return existing customer when user has valid Stripe customer ID", async () => {
      const userId = "user_123";
      const customerId = "cus_123";
      const mockUser = {
        id: userId,
        email: "test@example.com",
        stripe_customer_id: customerId,
      };

      const mockCustomer = {
        id: customerId,
        email: mockUser.email,
        deleted: false,
      };

      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      const result = await customerService.syncCustomerWithUser(userId);

      expect(result).toEqual(mockCustomer);
      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith(customerId);
    });

    it("should throw NotFoundException when user not found", async () => {
      const userId = "nonexistent_user";

      mockUserService.findById.mockResolvedValue(null);

      await expect(
        customerService.syncCustomerWithUser(userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("ensureCustomerExists", () => {
    it("should return customer ID", async () => {
      const userId = "user_123";
      const customerId = "cus_123";
      const mockUser = {
        id: userId,
        email: "test@example.com",
        stripe_customer_id: customerId,
      };

      const mockCustomer = {
        id: customerId,
        email: mockUser.email,
        deleted: false,
      };

      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      const result = await customerService.ensureCustomerExists(userId);

      expect(result).toBe(customerId);
    });
  });

  describe("attachPaymentMethod", () => {
    it("should attach payment method to customer", async () => {
      const customerId = "cus_123";
      const paymentMethodId = "pm_123";
      const mockPaymentMethod = {
        id: paymentMethodId,
        customer: customerId,
      };

      mockStripe.paymentMethods.attach.mockResolvedValue(mockPaymentMethod);

      const result = await customerService.attachPaymentMethod(
        customerId,
        paymentMethodId,
      );

      expect(result).toEqual(mockPaymentMethod);
      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith(
        paymentMethodId,
        {
          customer: customerId,
        },
      );
    });
  });

  describe("getCustomerPaymentMethods", () => {
    it("should retrieve customer payment methods", async () => {
      const customerId = "cus_123";
      const mockPaymentMethods = [
        { id: "pm_123", type: "card" },
        { id: "pm_456", type: "card" },
      ];

      mockStripe.paymentMethods.list.mockResolvedValue({
        data: mockPaymentMethods,
      });

      const result =
        await customerService.getCustomerPaymentMethods(customerId);

      expect(result).toEqual(mockPaymentMethods);
      expect(mockStripe.paymentMethods.list).toHaveBeenCalledWith({
        customer: customerId,
        type: "card",
      });
    });
  });
});
