import morgan from "morgan";
import { Request, Response } from "express";
import { Container } from "typedi";
import { LoggerService } from "../services/logger.service";
import { config } from "../config/env";

export class MorganMiddleware {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static create(): any {
    // Custom token for response time in a more readable format
    morgan.token("response-time-ms", (req: Request, res: Response) => {
      const responseTime = (
        morgan as unknown as {
          "response-time": (req: Request, res: Response) => string;
        }
      )["response-time"](req, res);
      return responseTime ? `${responseTime}ms` : "-";
    });

    // Custom token for request ID
    morgan.token("request-id", (req: Request) => {
      return (req.headers["x-request-id"] as string) || "unknown";
    });

    // Custom token for user ID (if authenticated)
    morgan.token("user-id", (req: Request) => {
      return (
        (req as unknown as { user?: { id: string } }).user?.id || "anonymous"
      );
    });

    // Custom token for request body size
    morgan.token("req-size", (req: Request) => {
      const contentLength = req.headers["content-length"];
      return contentLength ? `${contentLength}B` : "-";
    });

    // Custom token for response body size
    morgan.token("res-size", (req: Request, res: Response) => {
      const contentLength = res.getHeader("content-length");
      return contentLength ? `${contentLength}B` : "-";
    });

    // Custom format based on environment
    const format =
      config.server.environment === "production"
        ? MorganMiddleware.productionFormat()
        : MorganMiddleware.developmentFormat();

    return morgan(format, {
      // Custom stream to integrate with our logger
      stream: {
        write: (message: string) => {
          // Parse the log message to determine log level
          const trimmedMessage = message.trim();

          // Extract status code from the message
          const statusMatch = trimmedMessage.match(/\s(\d{3})\s/);
          const statusCode = statusMatch ? parseInt(statusMatch[1]) : 200;

          const logger = Container.get(LoggerService);
          // Determine log level based on status code
          if (statusCode >= 500) {
            logger.error(trimmedMessage);
          } else if (statusCode >= 400) {
            logger.warn(trimmedMessage);
          } else {
            logger.info(trimmedMessage);
          }
        },
      },

      // Skip logging for certain conditions
      skip: (req: Request) => {
        // Skip health check logs in production to reduce noise
        if (
          config.server.environment === "production" &&
          req.path === "/health"
        ) {
          return true;
        }

        // Skip OPTIONS requests
        if (req.method === "OPTIONS") {
          return true;
        }

        return false;
      },
    });
  }

  private static productionFormat(): string {
    return JSON.stringify({
      timestamp: ":date[iso]",
      requestId: ":request-id",
      method: ":method",
      url: ":url",
      status: ":status",
      responseTime: ":response-time-ms",
      userAgent: ":user-agent",
      ip: ":remote-addr",
      userId: ":user-id",
      reqSize: ":req-size",
      resSize: ":res-size",
    });
  }

  private static developmentFormat(): string {
    // Colorized format for development
    return ":method :url :status :response-time-ms - :res-size :user-agent";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static errorLogger(): any {
    return morgan("combined", {
      skip: (req: Request, res: Response) => res.statusCode < 400,
      stream: {
        write: (message: string) => {
          const logger = Container.get(LoggerService);
          logger.error(`HTTP Error: ${message.trim()}`);
        },
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static webhookLogger(): any {
    return morgan(
      ":method :url :status :response-time-ms - webhook from :remote-addr",
      {
        skip: (req: Request) => !req.path.includes("/webhook"),
        stream: {
          write: (message: string) => {
            const logger = Container.get(LoggerService);
            logger.info(`Webhook: ${message.trim()}`);
          },
        },
      },
    );
  }
}
