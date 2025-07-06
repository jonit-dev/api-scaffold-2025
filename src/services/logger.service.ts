import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { Service } from "typedi";
import { config } from "../config/env";
import path from "path";
import fs from "fs";

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Custom colors for log levels
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

@Service()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (config.logging.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
            winston.format.colorize({ all: true }),
            winston.format.printf((info) => {
              return `${info.timestamp} [${info.level}]: ${info.message}`;
            }),
          ),
        }),
      );
    }

    // File transport with rotation
    if (config.logging.enableFile) {
      // Ensure log directory exists
      const logDir = path.resolve(config.logging.dir);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Combined logs (all levels)
      transports.push(
        new DailyRotateFile({
          filename: path.join(logDir, "combined-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          zippedArchive: true,
          maxSize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // Error logs (errors only)
      transports.push(
        new DailyRotateFile({
          filename: path.join(logDir, "error-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          zippedArchive: true,
          maxSize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles,
          level: "error",
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // HTTP logs (for request logging)
      transports.push(
        new DailyRotateFile({
          filename: path.join(logDir, "http-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          zippedArchive: true,
          maxSize: config.logging.maxSize,
          maxFiles: config.logging.maxFiles,
          level: "http",
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    return winston.createLogger({
      level: this.getLogLevel(),
      levels,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports,
      exitOnError: false,
    });
  }

  private getLogLevel(): string {
    const level = config.logging.level.toLowerCase();
    return Object.keys(levels).includes(level) ? level : "info";
  }

  // Public logging methods
  error(message: string, meta?: object): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: object): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: object): void {
    this.logger.info(message, meta);
  }

  http(message: string, meta?: object): void {
    this.logger.http(message, meta);
  }

  debug(message: string, meta?: object): void {
    this.logger.debug(message, meta);
  }

  // Specialized logging methods
  logError(error: Error, context?: string): void {
    this.error(`${context ? `[${context}] ` : ""}${error.message}`, {
      stack: error.stack,
      name: error.name,
      context,
    });
  }

  logRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userAgent?: string,
    ip?: string,
  ): void {
    this.http("HTTP Request", {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      userAgent,
      ip,
    });
  }

  logStripeEvent(eventType: string, eventId: string, processed: boolean): void {
    this.info("Stripe webhook event", {
      eventType,
      eventId,
      processed,
      service: "stripe",
    });
  }

  logDatabaseOperation(
    operation: string,
    table: string,
    success: boolean,
    duration?: number,
  ): void {
    this.debug("Database operation", {
      operation,
      table,
      success,
      duration: duration ? `${duration}ms` : undefined,
      service: "database",
    });
  }

  logCacheOperation(
    operation: string,
    key: string,
    hit: boolean,
    duration?: number,
  ): void {
    this.debug("Cache operation", {
      operation,
      key,
      hit,
      duration: duration ? `${duration}ms` : undefined,
      service: "cache",
    });
  }

  logAuthEvent(
    event: string,
    userId?: string,
    success?: boolean,
    details?: object,
  ): void {
    this.info("Authentication event", {
      event,
      userId,
      success,
      details,
      service: "auth",
    });
  }

  // Get the underlying Winston logger instance (for advanced usage)
  getLogger(): winston.Logger {
    return this.logger;
  }

  // Create child logger with additional context
  child(meta: object): winston.Logger {
    return this.logger.child(meta);
  }
}

// Export a singleton instance for convenience
export const logger = new LoggerService();
