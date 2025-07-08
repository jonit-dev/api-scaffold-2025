import { vi } from "vitest";
import { Container } from "typedi";
import { EmailTemplateService } from "../../src/services/email-template.service";

// Mock EmailTemplateService
export const createMockEmailTemplateService = () => ({
  renderTemplate: vi.fn().mockResolvedValue("<html>Test email template</html>"),
  getAvailableTemplates: vi
    .fn()
    .mockReturnValue(["welcome", "password-reset", "invoice"]),
  validateTemplate: vi.fn().mockReturnValue(true),
});

// Register template mocks
export const registerTemplateMocks = () => {
  Container.set(EmailTemplateService, createMockEmailTemplateService());
};

// Reset template mocks
export const resetTemplateMocks = () => {
  const templateService = Container.get(EmailTemplateService) as any;

  if (templateService) {
    Object.values(templateService).forEach((fn: any) => {
      if (fn && typeof fn.mockClear === "function") {
        fn.mockClear();
      }
    });
  }
};
