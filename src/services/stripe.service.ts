import { Service } from "typedi";
import Stripe from "stripe";
import { config } from "../config/env";

@Service()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.validateConfiguration();
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: config.stripe.apiVersion,
      typescript: true,
      appInfo: {
        name: "API Scaffold",
        version: "1.0.0",
        url: "https://github.com/user/api-scaffold",
      },
    });
  }

  private validateConfiguration(): void {
    const requiredVars = [
      { key: "STRIPE_SECRET_KEY", value: config.stripe.secretKey },
      { key: "STRIPE_PUBLISHABLE_KEY", value: config.stripe.publishableKey },
      { key: "STRIPE_WEBHOOK_SECRET", value: config.stripe.webhookSecret },
    ];

    const missingVars = requiredVars.filter(
      ({ value }) => !value || value.includes("default"),
    );

    if (missingVars.length > 0) {
      const missing = missingVars.map(({ key }) => key).join(", ");
      throw new Error(
        `Missing required Stripe environment variables: ${missing}`,
      );
    }
  }

  public getStripeInstance(): Stripe {
    return this.stripe;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.stripe.accounts.retrieve();
      return true;
    } catch (error) {
      console.error("Stripe connection test failed:", error);
      return false;
    }
  }
}
