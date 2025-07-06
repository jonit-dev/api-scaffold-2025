import { Service } from "typedi";
import Stripe from "stripe";
import { StripeService } from "./stripe.service";
import { UserService } from "./user.service";
import {
  ICreateCustomerData,
  IUpdateCustomerData,
  StripeCustomer,
} from "../types/stripe.types";
import {
  handleStripeError,
  StripeCustomerException,
} from "../exceptions/stripe.exception";
import { NotFoundException } from "../exceptions/http-exceptions";

@Service()
export class StripeCustomerService {
  private stripe: Stripe;

  constructor(
    private stripeService: StripeService,
    private userService: UserService,
  ) {
    this.stripe = this.stripeService.getStripeInstance();
  }

  async createCustomer(data: ICreateCustomerData): Promise<StripeCustomer> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        phone: data.phone,
        description: data.description,
        metadata: {
          ...data.metadata,
          created_by: "api-scaffold",
        },
      });

      return customer;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to create customer: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async updateCustomer(
    customerId: string,
    data: IUpdateCustomerData,
  ): Promise<StripeCustomer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        email: data.email,
        name: data.name,
        phone: data.phone,
        description: data.description,
        metadata: data.metadata,
      });

      return customer;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to update customer: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getCustomer(customerId: string): Promise<StripeCustomer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        throw new NotFoundException(`Customer ${customerId} has been deleted`);
      }

      return customer as StripeCustomer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to retrieve customer: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getCustomerByEmail(email: string): Promise<StripeCustomer | null> {
    try {
      const customers = await this.stripe.customers.list({
        email,
        limit: 1,
      });

      return customers.data.length > 0 ? customers.data[0] : null;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to find customer by email: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    try {
      const deletedCustomer = await this.stripe.customers.del(customerId);
      return deletedCustomer;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to delete customer: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async syncCustomerWithUser(userId: string): Promise<StripeCustomer> {
    try {
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Check if user already has a Stripe customer ID
      if (user.stripeCustomerId) {
        try {
          return await this.getCustomer(user.stripeCustomerId);
        } catch {
          // If customer doesn't exist in Stripe, create a new one
          // Note: This console.warn is preserved for debugging critical user state issues
          console.warn(
            `Stripe customer ${user.stripeCustomerId} not found, creating new one`,
          );
        }
      }

      // Create new customer
      const customer = await this.createCustomer({
        email: user.email,
        name: user.fullName || user.email,
        metadata: {
          user_id: userId,
        },
      });

      // Update user with Stripe customer ID
      await this.userService.update(userId, {
        stripeCustomerId: customer.id,
      });

      return customer;
    } catch (error) {
      if (
        error instanceof StripeCustomerException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new StripeCustomerException(
        `Failed to sync customer with user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async ensureCustomerExists(userId: string): Promise<string> {
    const customer = await this.syncCustomerWithUser(userId);
    return customer.id;
  }

  async listCustomers(
    limit: number = 10,
    startingAfter?: string,
  ): Promise<Stripe.ApiList<StripeCustomer>> {
    try {
      const customers = await this.stripe.customers.list({
        limit,
        starting_after: startingAfter,
      });

      return customers;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to list customers: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: customerId },
      );

      return paymentMethod;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to attach payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod =
        await this.stripe.paymentMethods.detach(paymentMethodId);

      return paymentMethod;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to detach payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getCustomerPaymentMethods(
    customerId: string,
    type: Stripe.PaymentMethodListParams.Type = "card",
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type,
      });

      return paymentMethods.data;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeCustomerException(
        `Failed to get customer payment methods: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
