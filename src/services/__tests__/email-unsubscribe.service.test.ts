import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "typedi";
import { EmailService } from "../email.service";
import { EmailTemplateService } from "../email-template.service";
import { UserRepository } from "../../repositories/user.repository";
import { LoggerService } from "../logger.service";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";

describe("EmailService - Unsubscribe Functionality", () => {
  let emailService: EmailService;
  let userRepository: UserRepository;
  let loggerService: LoggerService;
  let emailTemplateService: EmailTemplateService;

  beforeEach(() => {
    // Create mocks
    userRepository = {
      findUnsubscribedUsers: vi.fn(),
    } as unknown as UserRepository;

    loggerService = {
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;

    emailTemplateService = {
      render: vi.fn().mockResolvedValue({ html: "<p>Test Email</p>" }),
    } as unknown as EmailTemplateService;

    // Create EmailService with mocked dependencies
    emailService = new EmailService(
      loggerService,
      emailTemplateService,
      userRepository,
    );

    // Mock the Resend client
    vi.clearAllMocks();
  });

  describe("Email filtering for unsubscribed users", () => {
    it("should filter out unsubscribed users from email recipients", async () => {
      // Arrange
      const recipients = ["user1@test.com", "user2@test.com", "user3@test.com"];
      const unsubscribedUsers = [
        {
          id: "user2",
          email: "user2@test.com",
          firstName: "User",
          lastName: "Two",
          passwordHash: "hash",
          role: UserRole.User,
          status: UserStatus.Active,
          emailUnsubscribed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      userRepository.findUnsubscribedUsers = vi
        .fn()
        .mockResolvedValue(unsubscribedUsers);

      // Mock the actual email sending to avoid hitting external service
      const mockResendSend = vi.fn().mockResolvedValue({
        data: { id: "test-email-id" },
        error: null,
      });

      // Replace the internal resend client

      (emailService as any).resend = {
        emails: {
          send: mockResendSend,
        },
      };

      // Act
      const result = await emailService.send({
        to: recipients,
        subject: "Test Email",
        html: "<p>Test content</p>",
      });

      // Assert
      expect(userRepository.findUnsubscribedUsers).toHaveBeenCalledWith(
        recipients,
      );
      expect(loggerService.info).toHaveBeenCalledWith(
        "Skipping emails to unsubscribed users",
        {
          unsubscribedEmails: ["user2@test.com"],
          totalEmails: 3,
        },
      );

      // Verify only non-unsubscribed users received the email
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@test.com", "user3@test.com"],
        }),
      );

      expect(result.success).toBe(true);
    });

    it("should skip sending email when all recipients are unsubscribed", async () => {
      // Arrange
      const recipients = ["user1@test.com", "user2@test.com"];
      const unsubscribedUsers = [
        {
          id: "user1",
          email: "user1@test.com",
          firstName: "User",
          lastName: "One",
          passwordHash: "hash",
          role: UserRole.User,
          status: UserStatus.Active,
          emailUnsubscribed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "user2",
          email: "user2@test.com",
          firstName: "User",
          lastName: "Two",
          passwordHash: "hash",
          role: UserRole.User,
          status: UserStatus.Active,
          emailUnsubscribed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      userRepository.findUnsubscribedUsers = vi
        .fn()
        .mockResolvedValue(unsubscribedUsers);

      const mockResendSend = vi.fn();

      (emailService as any).resend = {
        emails: {
          send: mockResendSend,
        },
      };

      // Act
      const result = await emailService.send({
        to: recipients,
        subject: "Test Email",
        html: "<p>Test content</p>",
      });

      // Assert
      expect(loggerService.info).toHaveBeenCalledWith(
        "All recipients have unsubscribed, skipping email",
      );
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.id).toBe("all-unsubscribed");
    });

    it("should send email normally when no recipients are unsubscribed", async () => {
      // Arrange
      const recipients = ["user1@test.com", "user2@test.com"];

      userRepository.findUnsubscribedUsers = vi.fn().mockResolvedValue([]);

      const mockResendSend = vi.fn().mockResolvedValue({
        data: { id: "test-email-id" },
        error: null,
      });

      (emailService as any).resend = {
        emails: {
          send: mockResendSend,
        },
      };

      // Act
      const result = await emailService.send({
        to: recipients,
        subject: "Test Email",
        html: "<p>Test content</p>",
      });

      // Assert
      expect(userRepository.findUnsubscribedUsers).toHaveBeenCalledWith(
        recipients,
      );
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: recipients,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.id).toBe("test-email-id");
    });

    it("should handle single email recipient correctly", async () => {
      // Arrange
      const recipient = "user1@test.com";

      userRepository.findUnsubscribedUsers = vi.fn().mockResolvedValue([]);

      const mockResendSend = vi.fn().mockResolvedValue({
        data: { id: "test-email-id" },
        error: null,
      });

      (emailService as any).resend = {
        emails: {
          send: mockResendSend,
        },
      };

      // Act
      const result = await emailService.send({
        to: recipient,
        subject: "Test Email",
        html: "<p>Test content</p>",
      });

      // Assert
      expect(userRepository.findUnsubscribedUsers).toHaveBeenCalledWith([
        recipient,
      ]);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [recipient],
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Template email with unsubscribe filtering", () => {
    it("should filter unsubscribed users when sending template emails", async () => {
      // Arrange
      const recipients = ["user1@test.com", "user2@test.com"];
      const unsubscribedUsers = [
        {
          id: "user2",
          email: "user2@test.com",
          firstName: "User",
          lastName: "Two",
          passwordHash: "hash",
          role: UserRole.User,
          status: UserStatus.Active,
          emailUnsubscribed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      userRepository.findUnsubscribedUsers = vi
        .fn()
        .mockResolvedValue(unsubscribedUsers);

      const mockResendSend = vi.fn().mockResolvedValue({
        data: { id: "test-email-id" },
        error: null,
      });

      (emailService as any).resend = {
        emails: {
          send: mockResendSend,
        },
      };

      // Act
      const result = await emailService.sendWithTemplate(
        "welcome",
        { firstName: "Test" },
        {
          to: recipients,
          subject: "Welcome Email",
        },
      );

      // Assert
      expect(emailTemplateService.render).toHaveBeenCalledWith("welcome", {
        firstName: "Test",
      });
      expect(userRepository.findUnsubscribedUsers).toHaveBeenCalledWith(
        recipients,
      );
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@test.com"],
        }),
      );
      expect(result.success).toBe(true);
    });
  });
});
