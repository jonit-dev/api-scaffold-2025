import { Body, JsonController, Post, Get } from "routing-controllers";
import { Service } from "typedi";
import { EmailService } from "../services/email.service";
import { LoggerService } from "../services/logger.service";
import { BadRequest, InternalServerError } from "../exceptions/http-exceptions";
import { RequireRole } from "../decorators/auth.decorator";
import { UserRole } from "../models/enums/user-roles.enum";

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

      const result = await this.emailService.sendWithTemplate(
        templateName as string,
        templateData as Record<string, unknown>,
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
        appName = "Your App",
        verificationUrl,
      } = body as Record<string, unknown>;

      if (!to || !firstName) {
        throw new BadRequest("Missing required fields: to and firstName");
      }

      const templateData = {
        firstName,
        appName,
        verificationUrl,
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
        resetUrl,
        expirationHours = 24,
        appName = "Your App",
      } = body as Record<string, unknown>;

      if (!to || !firstName || !resetUrl) {
        throw new BadRequest(
          "Missing required fields: to, firstName, and resetUrl",
        );
      }

      const templateData = {
        firstName,
        resetUrl,
        expirationHours,
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
}
