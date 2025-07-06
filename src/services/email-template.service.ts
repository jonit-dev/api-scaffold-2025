import Handlebars from "handlebars";
import * as fs from "fs/promises";
import * as path from "path";
import { Service } from "typedi";
import { LoggerService } from "./logger.service";

interface ITemplateData {
  [key: string]: unknown;
}

interface IEmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

@Service()
export class EmailTemplateService {
  private templatesPath: string;
  private templateCache: Map<string, IEmailTemplate> = new Map();

  constructor(private logger: LoggerService) {
    this.templatesPath = path.join(process.cwd(), "src", "templates", "emails");
    this.registerHelpers();
  }

  private registerHelpers(): void {
    // Register common Handlebars helpers
    Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
    Handlebars.registerHelper("ne", (a: unknown, b: unknown) => a !== b);
    Handlebars.registerHelper("gt", (a: number, b: number) => a > b);
    Handlebars.registerHelper("lt", (a: number, b: number) => a < b);
    Handlebars.registerHelper("and", (a: unknown, b: unknown) => a && b);
    Handlebars.registerHelper("or", (a: unknown, b: unknown) => a || b);
    Handlebars.registerHelper("not", (a: unknown) => !a);

    // Date formatting helper
    Handlebars.registerHelper(
      "formatDate",
      (date: Date | string, format: string = "YYYY-MM-DD") => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";

        switch (format) {
          case "YYYY-MM-DD":
            return d.toISOString().split("T")[0];
          case "MM/DD/YYYY":
            return d.toLocaleDateString("en-US");
          case "DD/MM/YYYY":
            return d.toLocaleDateString("en-GB");
          case "long":
            return d.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          default:
            return d.toISOString();
        }
      },
    );

    // Currency formatting helper
    Handlebars.registerHelper(
      "formatCurrency",
      (amount: number, currency: string = "USD") => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
        }).format(amount / 100); // Assuming amounts are in cents
      },
    );

    // Capitalize helper
    Handlebars.registerHelper("capitalize", (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Pluralize helper
    Handlebars.registerHelper(
      "pluralize",
      (count: number, singular: string, plural?: string) => {
        if (count === 1) return singular;
        return plural || singular + "s";
      },
    );
  }

  async render(
    templateName: string,
    data: ITemplateData,
  ): Promise<IEmailTemplate> {
    try {
      // Check cache first
      const cacheKey = `${templateName}_${JSON.stringify(data)}`;
      if (this.templateCache.has(cacheKey)) {
        this.logger.debug("Using cached template", { templateName });
        return this.templateCache.get(cacheKey)!;
      }

      // Load template files
      const templatePath = path.join(this.templatesPath, templateName);
      const [subjectTemplate, htmlTemplate, textTemplate] = await Promise.all([
        this.loadTemplate(path.join(templatePath, "subject.hbs")),
        this.loadTemplate(path.join(templatePath, "html.hbs")),
        this.loadTemplate(path.join(templatePath, "text.hbs"), false), // text template is optional
      ]);

      // Compile templates
      const compiledSubject = Handlebars.compile(subjectTemplate);
      const compiledHtml = Handlebars.compile(htmlTemplate);
      const compiledText = textTemplate
        ? Handlebars.compile(textTemplate)
        : undefined;

      // Render templates with data
      const rendered: IEmailTemplate = {
        subject: compiledSubject(data).trim(),
        html: compiledHtml(data),
        text: compiledText ? compiledText(data) : undefined,
      };

      // Cache the result
      this.templateCache.set(cacheKey, rendered);

      this.logger.debug("Template rendered successfully", { templateName });
      return rendered;
    } catch (error) {
      this.logger.error("Failed to render email template", {
        error,
        templateName,
        data,
      });
      throw new Error(`Failed to render template '${templateName}': ${error}`);
    }
  }

  private async loadTemplate(
    templatePath: string,
    required: boolean = true,
  ): Promise<string> {
    try {
      const template = await fs.readFile(templatePath, "utf-8");
      return template;
    } catch (error) {
      if (!required && (error as { code?: string }).code === "ENOENT") {
        return "";
      }
      this.logger.error("Failed to load template file", {
        error,
        templatePath,
      });
      throw new Error(`Template file not found: ${templatePath}`);
    }
  }

  async preloadTemplates(): Promise<void> {
    try {
      const templateDirs = await fs.readdir(this.templatesPath, {
        withFileTypes: true,
      });
      const dirs = templateDirs
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      this.logger.info("Found email templates", { templates: dirs });

      // Pre-compile templates for faster rendering
      for (const templateName of dirs) {
        try {
          const templatePath = path.join(this.templatesPath, templateName);
          const [subjectExists, htmlExists] = await Promise.all([
            this.fileExists(path.join(templatePath, "subject.hbs")),
            this.fileExists(path.join(templatePath, "html.hbs")),
          ]);

          if (subjectExists && htmlExists) {
            this.logger.debug("Template validated", { templateName });
          } else {
            this.logger.warn("Incomplete template structure", {
              templateName,
              subjectExists,
              htmlExists,
            });
          }
        } catch (error) {
          this.logger.error("Failed to validate template", {
            error,
            templateName,
          });
        }
      }
    } catch (error) {
      this.logger.warn("Failed to preload templates", {
        error,
        templatesPath: this.templatesPath,
      });
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.templateCache.clear();
    this.logger.debug("Template cache cleared");
  }

  getAvailableTemplates(): string[] {
    return Array.from(
      new Set(
        Array.from(this.templateCache.keys()).map((key) => key.split("_")[0]),
      ),
    );
  }
}
