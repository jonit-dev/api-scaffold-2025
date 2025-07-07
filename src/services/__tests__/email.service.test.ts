import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../email.service";
import { EmailTemplateService } from "../email-template.service";
import { LoggerService } from "../logger.service";
import { UserRepository } from "../../repositories/user.repository";
import { config } from "../../config/env";

// Mock dependencies
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(),
    },
  })),
}));

vi.mock("../email-template.service.js");
vi.mock("../logger.service.js");
vi.mock("../../repositories/user.repository.js");
vi.mock("../../config/env.js", () => ({
  config: {
    email: {
      resendApiKey: "test-api-key",
      fromAddress: "test@example.com",
      fromName: "Test App",
    },
    env: {
      nodeEnv: "test",
    },
    logging: {
      level: "info",
      format: "combined",
      enableConsole: true,
      enableFile: false,
      dir: "logs",
      maxSize: "20m",
      maxFiles: 14,
      enableRotation: true,
    },
  },
}));

describe("EmailService", () => {
  let emailService: EmailService;
  let mockResendSend: any;
  let mockTemplateService: any;
  let mockLogger: any;
  let mockUserRepository: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock implementations
    mockResendSend = vi.fn();

    mockTemplateService = {
      render: vi.fn(),
      preloadTemplates: vi.fn(),
      getAvailableTemplates: vi.fn(),
    };
    vi.mocked(EmailTemplateService).mockImplementation(
      () => mockTemplateService,
    );

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    vi.mocked(LoggerService).mockImplementation(() => mockLogger);

    mockUserRepository = {
      findUnsubscribedUsers: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(UserRepository).mockImplementation(() => mockUserRepository);

    emailService = new EmailService(
      mockLogger,
      mockTemplateService,
      mockUserRepository,
    );

    // Mock the resend instance on the created service
    (emailService as any).resend = {
      emails: { send: mockResendSend },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("send", () => {
    it("should send email successfully in production mode", async () => {
      // Arrange
      const originalNodeEnv = config.env.nodeEnv;
      (config.env as any).nodeEnv = "production";

      const emailData = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test text",
      };

      mockResendSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      // Act
      const result = await emailService.send(emailData);

      // Assert
      expect(result).toEqual({ success: true, id: "email-123" });
      expect(mockResendSend).toHaveBeenCalledWith({
        from: "Test App <test@example.com>",
        to: ["recipient@example.com"],
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test text",
        cc: undefined,
        bcc: undefined,
        replyTo: undefined,
        attachments: undefined,
        tags: undefined,
      });
      expect(mockLogger.info).toHaveBeenCalledWith("Email sent successfully", {
        emailId: "email-123",
        to: "recipient@example.com",
        originalRecipients: "recipient@example.com",
        unsubscribedCount: 0,
      });

      // Cleanup
      (config.env as any).nodeEnv = originalNodeEnv;
    });

    it("should log email details in development mode without sending", async () => {
      // Arrange
      const originalNodeEnv = config.env.nodeEnv;
      (config.env as any).nodeEnv = "development";

      // Create a new service instance with development mode
      const devEmailService = new EmailService(
        mockLogger,
        mockTemplateService,
        mockUserRepository,
      );
      (devEmailService as any).resend = {
        emails: { send: mockResendSend },
      };

      const emailData = {
        to: ["recipient1@example.com", "recipient2@example.com"],
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        cc: "cc@example.com",
        attachments: [
          {
            filename: "test.pdf",
            content: "test content",
            contentType: "application/pdf",
          },
        ],
      };

      // Act
      const result = await devEmailService.send(emailData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.id).toMatch(/^dev-mode-\d+$/);
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "📧 EMAIL SERVICE (DEV MODE - NOT SENT)",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "📧 Email Metadata:",
        expect.objectContaining({
          from: "Test App <test@example.com>",
          to: "recipient1@example.com,recipient2@example.com",
          subject: "Test Subject",
          cc: "cc@example.com",
        }),
      );

      // Cleanup
      (config.env as any).nodeEnv = originalNodeEnv;
    });

    it("should handle Resend API errors", async () => {
      // Arrange
      const originalNodeEnv = config.env.nodeEnv;
      (config.env as any).nodeEnv = "production";

      // Create a new service instance with production mode
      const prodEmailService = new EmailService(
        mockLogger,
        mockTemplateService,
        mockUserRepository,
      );
      const prodMockResendSend = vi.fn();
      (prodEmailService as any).resend = {
        emails: { send: prodMockResendSend },
      };

      const emailData = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      };

      prodMockResendSend.mockResolvedValue({
        data: null,
        error: { message: "Invalid API key" },
      });

      // Act
      const result = await prodEmailService.send(emailData);

      // Assert
      expect(result).toEqual({ success: false });
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to send email", {
        error: { message: "Invalid API key" },
        emailData,
      });

      // Cleanup
      (config.env as any).nodeEnv = originalNodeEnv;
    });

    it("should handle service exceptions", async () => {
      // Arrange
      const originalNodeEnv = config.env.nodeEnv;
      (config.env as any).nodeEnv = "production";

      const emailData = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      };

      const error = new Error("Network error");
      mockResendSend.mockRejectedValue(error);

      // Act
      const result = await emailService.send(emailData);

      // Assert
      expect(result).toEqual({ success: false });
      expect(mockLogger.error).toHaveBeenCalledWith("Email service error", {
        error,
        emailData,
      });

      // Cleanup
      (config.env as any).nodeEnv = originalNodeEnv;
    });

    it("should handle array and string recipients correctly", async () => {
      // Arrange
      const originalNodeEnv = config.env.nodeEnv;
      (config.env as any).nodeEnv = "production";

      mockResendSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      // Test with string recipient
      await emailService.send({
        to: "single@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["single@example.com"],
        }),
      );

      // Test with array recipient
      await emailService.send({
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@example.com", "user2@example.com"],
        }),
      );

      // Cleanup
      (config.env as any).nodeEnv = originalNodeEnv;
    });
  });

  describe("sendWithTemplate", () => {
    it("should render template and send email", async () => {
      // Arrange
      const originalNodeEnv = config.env.nodeEnv;
      (config.env as any).nodeEnv = "production";

      const templateData = { firstName: "John", appName: "Test App" };
      const emailData = {
        to: "recipient@example.com",
        subject: "Test Subject",
      };

      mockTemplateService.render.mockResolvedValue({
        subject: "Welcome John!",
        html: "<p>Welcome John to Test App!</p>",
        text: "Welcome John to Test App!",
      });

      mockResendSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      // Act
      const result = await emailService.sendWithTemplate(
        "welcome",
        templateData,
        emailData,
      );

      // Assert
      expect(result).toEqual({ success: true, id: "email-123" });
      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "welcome",
        templateData,
      );
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<p>Welcome John to Test App!</p>",
        }),
      );

      // Cleanup
      (config.env as any).nodeEnv = originalNodeEnv;
    });

    it("should handle template rendering errors", async () => {
      // Arrange
      const templateError = new Error("Template not found");
      mockTemplateService.render.mockRejectedValue(templateError);

      // Act
      const result = await emailService.sendWithTemplate(
        "nonexistent",
        {},
        {
          to: "test@example.com",
          subject: "Test",
        },
      );

      // Assert
      expect(result).toEqual({ success: false });
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Template email service error",
        {
          error: templateError,
          templateName: "nonexistent",
          emailData: { to: "test@example.com", subject: "Test" },
        },
      );
    });
  });

  describe("preloadTemplates", () => {
    it("should delegate to template service", async () => {
      // Act
      await emailService.preloadTemplates();

      // Assert
      expect(mockTemplateService.preloadTemplates).toHaveBeenCalled();
    });
  });

  describe("getAvailableTemplates", () => {
    it("should return available templates from template service", () => {
      // Arrange
      const templates = ["welcome", "password-reset", "invoice"];
      mockTemplateService.getAvailableTemplates.mockReturnValue(templates);

      // Act
      const result = emailService.getAvailableTemplates();

      // Assert
      expect(result).toEqual(templates);
      expect(mockTemplateService.getAvailableTemplates).toHaveBeenCalled();
    });
  });
});
