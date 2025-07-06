import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LoggerService } from "../logger.service";
import winston from "winston";
import fs from "fs";
import path from "path";

// Mock the config
vi.mock("../../config/env", () => ({
  config: {
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

describe("LoggerService", () => {
  let loggerService: LoggerService;
  let mockLogger: any;

  beforeEach(() => {
    // Mock winston logger
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      http: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLogger),
    };

    // Mock winston.createLogger
    vi.spyOn(winston, "createLogger").mockReturnValue(mockLogger);

    // Mock fs.existsSync and mkdirSync
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "mkdirSync").mockImplementation(() => "");

    loggerService = new LoggerService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic logging methods", () => {
    it("should log error messages", () => {
      const message = "Test error message";
      const meta = { key: "value" };

      loggerService.error(message, meta);

      expect(mockLogger.error).toHaveBeenCalledWith(message, meta);
    });

    it("should log warning messages", () => {
      const message = "Test warning message";
      const meta = { key: "value" };

      loggerService.warn(message, meta);

      expect(mockLogger.warn).toHaveBeenCalledWith(message, meta);
    });

    it("should log info messages", () => {
      const message = "Test info message";
      const meta = { key: "value" };

      loggerService.info(message, meta);

      expect(mockLogger.info).toHaveBeenCalledWith(message, meta);
    });

    it("should log http messages", () => {
      const message = "Test http message";
      const meta = { key: "value" };

      loggerService.http(message, meta);

      expect(mockLogger.http).toHaveBeenCalledWith(message, meta);
    });

    it("should log debug messages", () => {
      const message = "Test debug message";
      const meta = { key: "value" };

      loggerService.debug(message, meta);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, meta);
    });
  });

  describe("Specialized logging methods", () => {
    it("should log errors with context", () => {
      const error = new Error("Test error");
      const context = "TestService";

      loggerService.logError(error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `[${context}] ${error.message}`,
        {
          stack: error.stack,
          name: error.name,
          context,
        },
      );
    });

    it("should log HTTP requests", () => {
      loggerService.logRequest(
        "GET",
        "/test",
        200,
        150,
        "test-agent",
        "127.0.0.1",
      );

      expect(mockLogger.http).toHaveBeenCalledWith("HTTP Request", {
        method: "GET",
        url: "/test",
        statusCode: 200,
        responseTime: "150ms",
        userAgent: "test-agent",
        ip: "127.0.0.1",
      });
    });

    it("should log Stripe events", () => {
      loggerService.logStripeEvent("payment_intent.succeeded", "pi_123", true);

      expect(mockLogger.info).toHaveBeenCalledWith("Stripe webhook event", {
        eventType: "payment_intent.succeeded",
        eventId: "pi_123",
        processed: true,
        service: "stripe",
      });
    });

    it("should log database operations", () => {
      loggerService.logDatabaseOperation("SELECT", "users", true, 25);

      expect(mockLogger.debug).toHaveBeenCalledWith("Database operation", {
        operation: "SELECT",
        table: "users",
        success: true,
        duration: "25ms",
        service: "database",
      });
    });

    it("should log cache operations", () => {
      loggerService.logCacheOperation("GET", "user:123", true, 5);

      expect(mockLogger.debug).toHaveBeenCalledWith("Cache operation", {
        operation: "GET",
        key: "user:123",
        hit: true,
        duration: "5ms",
        service: "cache",
      });
    });

    it("should log authentication events", () => {
      loggerService.logAuthEvent("login", "user123", true, { ip: "127.0.0.1" });

      expect(mockLogger.info).toHaveBeenCalledWith("Authentication event", {
        event: "login",
        userId: "user123",
        success: true,
        details: { ip: "127.0.0.1" },
        service: "auth",
      });
    });
  });

  describe("Logger utilities", () => {
    it("should return the underlying Winston logger", () => {
      const underlyingLogger = loggerService.getLogger();

      expect(underlyingLogger).toBe(mockLogger);
    });

    it("should create a child logger with additional context", () => {
      const meta = { requestId: "123" };

      loggerService.child(meta);

      expect(mockLogger.child).toHaveBeenCalledWith(meta);
    });
  });

  describe("Error handling", () => {
    it("should handle errors without context", () => {
      const error = new Error("Test error");

      loggerService.logError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        stack: error.stack,
        name: error.name,
        context: undefined,
      });
    });

    it("should handle HTTP requests with missing optional parameters", () => {
      loggerService.logRequest("POST", "/api/test", 201, 75);

      expect(mockLogger.http).toHaveBeenCalledWith("HTTP Request", {
        method: "POST",
        url: "/api/test",
        statusCode: 201,
        responseTime: "75ms",
        userAgent: undefined,
        ip: undefined,
      });
    });
  });

  describe("Service-specific logging", () => {
    it("should include service context in logs", () => {
      // Test each service-specific logging method includes the service field
      loggerService.logDatabaseOperation("INSERT", "payments", true);
      loggerService.logCacheOperation("SET", "cache:key", false);
      loggerService.logAuthEvent("logout", "user456", true);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ service: "database" }),
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ service: "cache" }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ service: "auth" }),
      );
    });
  });
});
