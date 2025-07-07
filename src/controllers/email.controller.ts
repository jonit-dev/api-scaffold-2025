import { Body, JsonController, Post, Get } from "routing-controllers";
import { Service } from "typedi";
import { EmailService } from "../services/email.service";
import { LoggerService } from "../services/logger.service";
import { BadRequest, InternalServerError } from "../exceptions/http-exceptions";
import { RequireRole } from "../decorators/auth.decorator";
import { UserRole } from "../models/enums/user-roles.enum";
import { config } from "../config/env";

@Service()
@JsonController("/email")
export class EmailController {
  constructor(
    private emailService: EmailService,
    private logger: LoggerService,
  ) {}

  @Post("/send")
  @RequireRole(UserRole.Admin)
  async sendEmail(@Body() body: unknown): Promise<unknown> {
    try {
      const { to, subject, html, text, cc, bcc, replyTo, attachments, tags } =
        body as Record<string, unknown>;

      if (!to || !subject || (!html && !text)) {
        throw new BadRequest(
          "Missing required fields: to, subject, and html or text",
        );
      }

      const result = await this.emailService.send({
        to: to as string | string[],
        subject: subject as string,
        html: html as string | undefined,
        text: text as string | undefined,
        cc: cc as string | string[] | undefined,
        bcc: bcc as string | string[] | undefined,
        replyTo: replyTo as string | undefined,
        attachments: attachments as
          | Array<{
              filename: string;
              content: string | Buffer;
              contentType?: string;
            }>
          | undefined,
        tags: tags as Array<{ name: string; value: string }> | undefined,
      });

      if (!result.success) {
        throw new InternalServerError("Failed to send email");
      }

      return {
        success: true,
        message: "Email sent successfully",
        emailId: result.id,
      };
    } catch (error) {
      this.logger.error("Email controller error", { error, body });

      if (error instanceof BadRequest || error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError("Internal server error");
    }
  }

  @Post("/send-template")
  @RequireRole(UserRole.Admin)
  async sendTemplateEmail(@Body() body: unknown): Promise<unknown> {
    try {
      const {
        templateName,
        templateData,
        to,
        subject,
        cc,
        bcc,
        replyTo,
        attachments,
        tags,
      } = body as Record<string, unknown>;

      if (!templateName || !to || !templateData) {
        throw new BadRequest(
          "Missing required fields: templateName, to, and templateData",
        );
      }

      // Enhance template data with auto-generated URLs for specific templates
      const enhancedTemplateData = this.enhanceTemplateData(
        templateName as string,
        templateData as Record<string, unknown>,
      );

      const result = await this.emailService.sendWithTemplate(
        templateName as string,
        enhancedTemplateData,
        {
          to: to as string | string[],
          subject: subject as string,
          cc: cc as string | string[] | undefined,
          bcc: bcc as string | string[] | undefined,
          replyTo: replyTo as string | undefined,
          attachments: attachments as
            | Array<{
                filename: string;
                content: string | Buffer;
                contentType?: string;
              }>
            | undefined,
          tags: tags as Array<{ name: string; value: string }> | undefined,
        },
      );

      if (!result.success) {
        throw new InternalServerError("Failed to send template email");
      }

      return {
        success: true,
        message: "Template email sent successfully",
        emailId: result.id,
        templateName,
      };
    } catch (error) {
      this.logger.error("Template email controller error", { error, body });

      if (error instanceof BadRequest || error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError("Internal server error");
    }
  }

  @Get("/templates")
  @RequireRole(UserRole.Admin)
  async getAvailableTemplates(): Promise<unknown> {
    try {
      const templates = this.emailService.getAvailableTemplates();

      return {
        success: true,
        templates,
      };
    } catch (error) {
      this.logger.error("Get templates controller error", { error });
      throw new InternalServerError("Failed to get available templates");
    }
  }

  @Post("/welcome")
  @RequireRole(UserRole.Admin)
  async sendWelcomeEmail(@Body() body: unknown): Promise<unknown> {
    try {
      const {
        to,
        firstName,
        appName = config.email.fromName,
        verificationToken,
      } = body as Record<string, unknown>;

      if (!to || !firstName || !verificationToken) {
        throw new BadRequest(
          "Missing required fields: to, firstName, and verificationToken",
        );
      }

      const templateData = {
        firstName,
        appName,
        verificationUrl: `${config.env.frontendUrl}/auth/verify-email?token=${verificationToken}`,
        currentYear: new Date().getFullYear(),
      };

      const result = await this.emailService.sendWithTemplate(
        "welcome",
        templateData,
        {
          to: to as string,
          subject: `Welcome to ${appName}, ${firstName}!`,
        },
      );

      if (!result.success) {
        throw new InternalServerError("Failed to send welcome email");
      }

      return {
        success: true,
        message: "Welcome email sent successfully",
        emailId: result.id,
      };
    } catch (error) {
      this.logger.error("Welcome email controller error", { error, body });

      if (error instanceof BadRequest || error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError("Internal server error");
    }
  }

  @Post("/password-reset")
  @RequireRole(UserRole.Admin)
  async sendPasswordResetEmail(@Body() body: unknown): Promise<unknown> {
    try {
      const {
        to,
        firstName,
        resetToken,
        expirationHours = 24,
        appName = config.email.fromName,
      } = body as Record<string, unknown>;

      if (!to || !firstName || !resetToken) {
        throw new BadRequest(
          "Missing required fields: to, firstName, and resetToken",
        );
      }

      const templateData = {
        firstName,
        resetUrl: `${config.env.frontendUrl}/auth/reset-password?token=${resetToken}`,
        expiresIn: `${expirationHours} hours`,
        appName,
        currentYear: new Date().getFullYear(),
      };

      const result = await this.emailService.sendWithTemplate(
        "password-reset",
        templateData,
        {
          to: to as string,
          subject: `Reset your ${appName} password`,
        },
      );

      if (!result.success) {
        throw new InternalServerError("Failed to send password reset email");
      }

      return {
        success: true,
        message: "Password reset email sent successfully",
        emailId: result.id,
      };
    } catch (error) {
      this.logger.error("Password reset email controller error", {
        error,
        body,
      });

      if (error instanceof BadRequest || error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError("Internal server error");
    }
  }

  @Post("/invoice")
  @RequireRole(UserRole.Admin)
  async sendInvoiceEmail(@Body() body: unknown): Promise<unknown> {
    try {
      const {
        to,
        customerName,
        invoiceNumber,
        invoiceDate,
        amount,
        currency = "USD",
        status,
        items,
        downloadUrl,
        appName = "Your App",
      } = body as Record<string, unknown>;

      if (!to || !customerName || !invoiceNumber || !amount || !status) {
        throw new BadRequest(
          "Missing required fields: to, customerName, invoiceNumber, amount, and status",
        );
      }

      const templateData = {
        customerName,
        invoiceNumber,
        invoiceDate: invoiceDate || new Date(),
        amount,
        currency,
        status,
        items,
        downloadUrl,
        appName,
        currentYear: new Date().getFullYear(),
      };

      const result = await this.emailService.sendWithTemplate(
        "invoice",
        templateData,
        {
          to: to as string,
          subject: `Invoice #${invoiceNumber} from ${appName}`,
        },
      );

      if (!result.success) {
        throw new InternalServerError("Failed to send invoice email");
      }

      return {
        success: true,
        message: "Invoice email sent successfully",
        emailId: result.id,
        invoiceNumber,
      };
    } catch (error) {
      this.logger.error("Invoice email controller error", { error, body });

      if (error instanceof BadRequest || error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError("Internal server error");
    }
  }

  private enhanceTemplateData(
    templateName: string,
    templateData: Record<string, unknown>,
  ): Record<string, unknown> {
    const enhanced = { ...templateData };

    // Auto-generate URLs for welcome template
    if (templateName === "welcome") {
      // Add verificationUrl if verificationToken is provided but verificationUrl is not
      if (enhanced.verificationToken && !enhanced.verificationUrl) {
        enhanced.verificationUrl = `${config.env.frontendUrl}/auth/verify-email?token=${enhanced.verificationToken}`;
      }
      // Set default appName if not provided
      if (!enhanced.appName) {
        enhanced.appName = config.email.fromName;
      }
    }

    // Auto-generate URLs for password-reset template
    if (templateName === "password-reset") {
      // Add resetUrl if resetToken is provided but resetUrl is not
      if (enhanced.resetToken && !enhanced.resetUrl) {
        enhanced.resetUrl = `${config.env.frontendUrl}/auth/reset-password?token=${enhanced.resetToken}`;
      }
      // Set default appName if not provided
      if (!enhanced.appName) {
        enhanced.appName = config.email.fromName;
      }
      // Convert expirationHours to expiresIn format if provided
      if (enhanced.expirationHours && !enhanced.expiresIn) {
        enhanced.expiresIn = `${enhanced.expirationHours} hours`;
      }
    }

    // Always add currentYear
    enhanced.currentYear = new Date().getFullYear();

    return enhanced;
  }
}
