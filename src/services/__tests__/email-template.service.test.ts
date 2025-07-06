import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailTemplateService } from "../email-template.service";
import { LoggerService } from "../logger.service";
import * as fs from "fs/promises";
import * as path from "path";

// Mock dependencies
vi.mock("fs/promises");
vi.mock("../logger.service.js");

describe("EmailTemplateService", () => {
  let templateService: EmailTemplateService;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    };
    vi.mocked(LoggerService).mockImplementation(() => mockLogger);

    templateService = new EmailTemplateService(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("render", () => {
    it("should render a complete email template", async () => {
      // Arrange
      const templateName = "welcome";
      const templateData = {
        firstName: "John",
        appName: "Test App",
        verificationUrl: "https://example.com/verify",
        currentYear: 2024,
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("Welcome to {{appName}}, {{firstName}}!") // subject.hbs
        .mockResolvedValueOnce(
          '<h1>Welcome {{firstName}} to {{appName}}!</h1>{{#if verificationUrl}}<a href="{{verificationUrl}}">Verify</a>{{/if}}',
        ) // html.hbs
        .mockResolvedValueOnce(
          "Welcome {{firstName}} to {{appName}}!\n{{#if verificationUrl}}Verify: {{verificationUrl}}{{/if}}",
        ); // text.hbs

      // Act
      const result = await templateService.render(templateName, templateData);

      // Assert
      expect(result).toEqual({
        subject: "Welcome to Test App, John!",
        html: '<h1>Welcome John to Test App!</h1><a href="https://example.com/verify">Verify</a>',
        text: "Welcome John to Test App!\nVerify: https://example.com/verify",
      });

      expect(fs.readFile).toHaveBeenCalledTimes(3);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Template rendered successfully",
        {
          templateName: "welcome",
        },
      );
    });

    it("should handle optional text template", async () => {
      // Arrange
      const templateName = "welcome";
      const templateData = { firstName: "John", appName: "Test App" };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("Welcome to {{appName}}, {{firstName}}!") // subject.hbs
        .mockResolvedValueOnce("<h1>Welcome {{firstName}} to {{appName}}!</h1>") // html.hbs
        .mockRejectedValueOnce({ code: "ENOENT" }); // text.hbs not found

      // Act
      const result = await templateService.render(templateName, templateData);

      // Assert
      expect(result).toEqual({
        subject: "Welcome to Test App, John!",
        html: "<h1>Welcome John to Test App!</h1>",
        text: undefined,
      });
    });

    it("should throw error when required template files are missing", async () => {
      // Arrange
      const templateName = "welcome";
      const templateData = { firstName: "John" };

      vi.mocked(fs.readFile)
        .mockRejectedValueOnce({ code: "ENOENT" }) // subject.hbs not found
        .mockResolvedValueOnce("<h1>Welcome</h1>") // html.hbs
        .mockResolvedValueOnce("Welcome"); // text.hbs

      // Act & Assert
      await expect(
        templateService.render(templateName, templateData),
      ).rejects.toThrow("Failed to render template 'welcome'");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to render email template",
        {
          error: expect.any(Error),
          templateName: "welcome",
          data: templateData,
        },
      );
    });

    it("should use template cache for repeated renders", async () => {
      // Arrange
      const templateName = "welcome";
      const templateData = { firstName: "John", appName: "Test App" };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("Welcome to {{appName}}, {{firstName}}!") // subject.hbs
        .mockResolvedValueOnce("<h1>Welcome {{firstName}} to {{appName}}!</h1>") // html.hbs
        .mockResolvedValueOnce("Welcome {{firstName}} to {{appName}}!"); // text.hbs

      // First render
      await templateService.render(templateName, templateData);

      // Clear mock calls
      vi.mocked(fs.readFile).mockClear();
      mockLogger.debug.mockClear();

      // Second render with same data
      const result = await templateService.render(templateName, templateData);

      // Assert
      expect(fs.readFile).not.toHaveBeenCalled(); // Should use cache
      expect(mockLogger.debug).toHaveBeenCalledWith("Using cached template", {
        templateName: "welcome",
      });
      expect(result.subject).toBe("Welcome to Test App, John!");
    });
  });

  describe("Handlebars helpers", () => {
    beforeEach(() => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("{{helper_test}}") // subject.hbs
        .mockResolvedValueOnce("{{result}}") // html.hbs
        .mockResolvedValueOnce("{{result}}"); // text.hbs
    });

    it("should register and use formatDate helper", async () => {
      // Arrange
      const templateData = {
        helper_test: "Date test",
        result: "{{formatDate testDate 'MM/DD/YYYY'}}",
        testDate: new Date("2024-01-15"),
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("Date test") // subject.hbs
        .mockResolvedValueOnce("{{formatDate testDate 'MM/DD/YYYY'}}") // html.hbs
        .mockResolvedValueOnce("{{formatDate testDate 'MM/DD/YYYY'}}"); // text.hbs

      // Act
      const result = await templateService.render("test", templateData);

      // Assert
      expect(result.html).toBe("1/15/2024");
    });

    it("should register and use formatCurrency helper", async () => {
      // Arrange
      const templateData = {
        amount: 1500, // $15.00 in cents
        currency: "USD",
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("Currency test") // subject.hbs
        .mockResolvedValueOnce("{{formatCurrency amount currency}}") // html.hbs
        .mockResolvedValueOnce("{{formatCurrency amount currency}}"); // text.hbs

      // Act
      const result = await templateService.render("test", templateData);

      // Assert
      expect(result.html).toBe("$15.00");
    });

    it("should register and use conditional helpers", async () => {
      // Arrange
      const templateData = {
        count: 5,
        status: "active",
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("Conditional test") // subject.hbs
        .mockResolvedValueOnce(
          "{{#if (gt count 3)}}Greater than 3{{/if}} {{#if (eq status 'active')}}Active{{/if}}",
        ) // html.hbs
        .mockResolvedValueOnce(
          "{{#if (gt count 3)}}Greater than 3{{/if}} {{#if (eq status 'active')}}Active{{/if}}",
        ); // text.hbs

      // Act
      const result = await templateService.render("test", templateData);

      // Assert
      expect(result.html).toBe("Greater than 3 Active");
    });

    it("should register and use pluralize helper", async () => {
      // Arrange
      const templateData = {
        itemCount: 1,
        orderCount: 3,
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce("Pluralize test") // subject.hbs
        .mockResolvedValueOnce(
          "{{itemCount}} {{pluralize itemCount 'item'}} and {{orderCount}} {{pluralize orderCount 'order'}}",
        ) // html.hbs
        .mockResolvedValueOnce(
          "{{itemCount}} {{pluralize itemCount 'item'}} and {{orderCount}} {{pluralize orderCount 'order'}}",
        ); // text.hbs

      // Act
      const result = await templateService.render("test", templateData);

      // Assert
      expect(result.html).toBe("1 item and 3 orders");
    });
  });

  describe("preloadTemplates", () => {
    it("should discover and validate template directories", async () => {
      // Arrange
      const mockDirents = [
        { name: "welcome", isDirectory: () => true },
        { name: "password-reset", isDirectory: () => true },
        { name: "invoice", isDirectory: () => true },
        { name: "readme.txt", isDirectory: () => false },
      ];

      vi.mocked(fs.readdir).mockResolvedValue(mockDirents as any);
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // welcome/subject.hbs exists
        .mockResolvedValueOnce(undefined) // welcome/html.hbs exists
        .mockResolvedValueOnce(undefined) // password-reset/subject.hbs exists
        .mockResolvedValueOnce(undefined) // password-reset/html.hbs exists
        .mockResolvedValueOnce(undefined) // invoice/subject.hbs exists
        .mockRejectedValueOnce(new Error("ENOENT")); // invoice/html.hbs missing

      // Act
      await templateService.preloadTemplates();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith("Found email templates", {
        templates: ["welcome", "password-reset", "invoice"],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith("Template validated", {
        templateName: "welcome",
      });
      expect(mockLogger.debug).toHaveBeenCalledWith("Template validated", {
        templateName: "password-reset",
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Incomplete template structure",
        {
          templateName: "invoice",
          subjectExists: true,
          htmlExists: false,
        },
      );
    });

    it("should handle missing templates directory gracefully", async () => {
      // Arrange
      vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));

      // Act
      await templateService.preloadTemplates();

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to preload templates",
        {
          error: expect.any(Error),
          templatesPath: expect.stringContaining("src/templates/emails"),
        },
      );
    });
  });

  describe("clearCache", () => {
    it("should clear the template cache", () => {
      // Act
      templateService.clearCache();

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith("Template cache cleared");
    });
  });

  describe("getAvailableTemplates", () => {
    it("should return unique template names from cache", async () => {
      // Arrange - render some templates to populate cache
      vi.mocked(fs.readFile).mockResolvedValue("test template");

      await templateService.render("welcome", { name: "John" });
      await templateService.render("welcome", { name: "Jane" });
      await templateService.render("invoice", { number: "123" });

      // Act
      const result = templateService.getAvailableTemplates();

      // Assert
      expect(result).toEqual(expect.arrayContaining(["welcome", "invoice"]));
      expect(result.length).toBe(2); // Should be unique
    });

    it("should return empty array when no templates cached", () => {
      // Act
      const result = templateService.getAvailableTemplates();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
