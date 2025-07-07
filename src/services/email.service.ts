import { Resend } from "resend";
import { Service } from "typedi";
import { config } from "../config/env";
import { LoggerService } from "./logger.service";
import { EmailTemplateService } from "./email-template.service";
import { UserRepository } from "../repositories/user.repository";

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
    private userRepository: UserRepository,
  ) {
    this.resend = new Resend(config.email.resendApiKey);
    this.isDevMode = config.env.nodeEnv === "development";
  }

  private async checkUnsubscribedUsers(emails: string[]): Promise<string[]> {
    const unsubscribedUsers =
      await this.userRepository.findUnsubscribedUsers(emails);
    return unsubscribedUsers.map((user) => user.email);
  }

  private filterUnsubscribedEmails(
    emails: string[],
    unsubscribedEmails: string[],
  ): string[] {
    return emails.filter((email) => !unsubscribedEmails.includes(email));
  }

  async send(
    emailData: IEmailData,
  ): Promise<{ id?: string; success: boolean }> {
    try {
      const emailList = Array.isArray(emailData.to)
        ? emailData.to
        : [emailData.to];
      const unsubscribedEmails = await this.checkUnsubscribedUsers(emailList);

      if (unsubscribedEmails.length > 0) {
        this.logger.info("Skipping emails to unsubscribed users", {
          unsubscribedEmails,
          totalEmails: emailList.length,
        });
      }

      const filteredEmails = this.filterUnsubscribedEmails(
        emailList,
        unsubscribedEmails,
      );

      if (filteredEmails.length === 0) {
        this.logger.info("All recipients have unsubscribed, skipping email");
        return { success: true, id: "all-unsubscribed" };
      }

      const filteredEmailData = {
        ...emailData,
        to: filteredEmails.length === 1 ? filteredEmails[0] : filteredEmails,
      };
      if (this.isDevMode) {
        const emailMetadata = {
          from: `${config.email.fromName} <${config.email.fromAddress}>`,
          to: Array.isArray(filteredEmailData.to)
            ? filteredEmailData.to.join(", ")
            : filteredEmailData.to,
          subject: filteredEmailData.subject,
          ...(emailData.cc && {
            cc: Array.isArray(emailData.cc)
              ? emailData.cc.join(", ")
              : emailData.cc,
          }),
          ...(emailData.bcc && {
            bcc: Array.isArray(emailData.bcc)
              ? emailData.bcc.join(", ")
              : emailData.bcc,
          }),
          ...(emailData.replyTo && { replyTo: emailData.replyTo }),
          ...(emailData.attachments && {
            attachments: emailData.attachments.map((att) => ({
              filename: att.filename,
              contentType: att.contentType || "unknown",
              size:
                typeof att.content === "string"
                  ? `${att.content.length} chars`
                  : `${att.content.length} bytes`,
            })),
          }),
          ...(emailData.tags && {
            tags: emailData.tags
              .map((tag) => `${tag.name}:${tag.value}`)
              .join(", "),
          }),
        };

        this.logger.info("📧 EMAIL SERVICE (DEV MODE - NOT SENT)");
        this.logger.info("📧 Email Metadata:", emailMetadata);

        if (emailData.html) {
          this.logger.info("📧 HTML Content Preview:", {
            length: `${emailData.html.length} chars`,
            preview:
              emailData.html.substring(0, 200) +
              (emailData.html.length > 200 ? "..." : ""),
          });
        }

        if (emailData.text) {
          this.logger.info("📧 Text Content:", {
            length: `${emailData.text.length} chars`,
            content: emailData.text,
          });
        }

        return { success: true, id: "dev-mode-" + Date.now() };
      }

      const { data, error } = await this.resend.emails.send({
        from: `${config.email.fromName} <${config.email.fromAddress}>`,
        to: Array.isArray(filteredEmailData.to)
          ? filteredEmailData.to
          : [filteredEmailData.to],
        subject: filteredEmailData.subject,
        html: filteredEmailData.html,
        text: filteredEmailData.text,
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
        to: filteredEmailData.to,
        originalRecipients: emailData.to,
        unsubscribedCount: unsubscribedEmails.length,
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
      if (this.isDevMode) {
        this.logger.info("📧 TEMPLATE EMAIL (DEV MODE)", {
          template: templateName,
          templateData,
        });
      }

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
