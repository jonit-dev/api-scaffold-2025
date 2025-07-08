import { vi } from "vitest";
import { Container } from "typedi";
import { EmailService } from "../../src/services/email.service";
import { EmailTemplateService } from "../../src/services/email-template.service";
import { LoggerService } from "../../src/services/logger.service";

// Mock EmailService
export const createMockEmailService = () => ({
  send: vi.fn().mockResolvedValue({
    success: true,
    id: "test-email-123",
  }),
  sendWithTemplate: vi.fn().mockResolvedValue({
    success: true,
    id: "test-template-email-123",
  }),
  getAvailableTemplates: vi
    .fn()
    .mockReturnValue(["welcome", "password-reset", "invoice"]),
  preloadTemplates: vi.fn().mockResolvedValue(undefined),
});

// Mock EmailTemplateService
export const createMockEmailTemplateService = () => ({
  render: vi.fn().mockResolvedValue({
    subject: "Test Subject",
    html: "<p>Test HTML</p>",
    text: "Test text",
  }),
  preloadTemplates: vi.fn().mockResolvedValue(undefined),
  getAvailableTemplates: vi
    .fn()
    .mockReturnValue(["welcome", "password-reset", "invoice"]),
  clearCache: vi.fn(),
});

// Mock LoggerService
export const createMockLoggerService = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
});

// Register email-related mocks
export const registerEmailMocks = () => {
  Container.set(EmailService, createMockEmailService());
  Container.set(EmailTemplateService, createMockEmailTemplateService());
  Container.set(LoggerService, createMockLoggerService());
};

// Reset email mocks
export const resetEmailMocks = () => {
  const emailService = Container.get(EmailService) as any;
  const loggerService = Container.get(LoggerService) as any;

  if (emailService) {
    Object.values(emailService).forEach((fn: any) => {
      if (fn && typeof fn.mockClear === "function") {
        fn.mockClear();
      }
    });
  }

  if (loggerService) {
    Object.values(loggerService).forEach((fn: any) => {
      if (fn && typeof fn.mockClear === "function") {
        fn.mockClear();
      }
    });
  }
};
