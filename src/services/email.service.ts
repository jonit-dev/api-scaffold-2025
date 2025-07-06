import { Resend } from "resend";
import { Service } from "typedi";
import { config } from "../config/env";
import { LoggerService } from "./logger.service";
import { EmailTemplateService } from "./email-template.service";

interface IEmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

interface IEmailData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: IEmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

interface IEmailTemplateData {
  [key: string]: unknown;
}

@Service()
export class EmailService {
  private resend: Resend;
  private isDevMode: boolean;

  constructor(
    private logger: LoggerService,
    private templateService: EmailTemplateService,
  ) {
    this.resend = new Resend(config.email.resendApiKey);
    this.isDevMode = config.env.nodeEnv === "development";
  }

  async send(
    emailData: IEmailData,
  ): Promise<{ id?: string; success: boolean }> {
    try {
      if (this.isDevMode) {
        this.logger.info("📧 EMAIL SERVICE (DEV MODE - NOT SENT)", {
          from: `${config.email.fromName} <${config.email.fromAddress}>`,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          cc: emailData.cc,
          bcc: emailData.bcc,
          replyTo: emailData.replyTo,
          attachments: emailData.attachments?.map((att) => ({
            filename: att.filename,
            contentType: att.contentType,
            contentSize:
              typeof att.content === "string"
                ? att.content.length
                : att.content.length,
          })),
          tags: emailData.tags,
        });
        return { success: true, id: "dev-mode-" + Date.now() };
      }

      const { data, error } = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromAddress}>`,
        to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        cc: emailData.cc
          ? Array.isArray(emailData.cc)
            ? emailData.cc
            : [emailData.cc]
          : undefined,
        bcc: emailData.bcc
          ? Array.isArray(emailData.bcc)
            ? emailData.bcc
            : [emailData.bcc]
          : undefined,
        replyTo: emailData.replyTo,
        attachments: emailData.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType,
        })),
        tags: emailData.tags,
      } as Parameters<typeof this.resend.emails.send>[0]);

      if (error) {
        this.logger.error("Failed to send email", { error, emailData });
        return { success: false };
      }

      this.logger.info("Email sent successfully", {
        emailId: data?.id,
        to: emailData.to,
      });
      return { success: true, id: data?.id };
    } catch (error) {
      this.logger.error("Email service error", { error, emailData });
      return { success: false };
    }
  }

  async sendWithTemplate(
    templateName: string,
    templateData: IEmailTemplateData,
    emailData: Omit<IEmailData, "html">,
  ): Promise<{ id?: string; success: boolean }> {
    try {
      const html = await this.renderTemplate(templateName, templateData);
      return this.send({ ...emailData, html });
    } catch (error) {
      this.logger.error("Template email service error", {
        error,
        templateName,
        emailData,
      });
      return { success: false };
    }
  }

  private async renderTemplate(
    templateName: string,
    data: IEmailTemplateData,
  ): Promise<string> {
    const template = await this.templateService.render(templateName, data);
    return template.html;
  }

  async preloadTemplates(): Promise<void> {
    await this.templateService.preloadTemplates();
  }

  getAvailableTemplates(): string[] {
    return this.templateService.getAvailableTemplates();
  }
}
