import { Request, Response, NextFunction } from "express";
import { Service } from "typedi";
import { LoggerService } from "../services/logger.service";

@Service()
export class RequestLoggerMiddleware {
  constructor(private loggerService: LoggerService) {}

  // Express middleware function
  log = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Log the incoming request
    this.loggerService.debug("Incoming request", {
      method: req.method,
      url: req.url,
      userAgent: req.get("User-Agent"),
      ip: req.ip || req.connection.remoteAddress,
      headers: this.sanitizeHeaders(req.headers),
    });

    // Override res.end to capture response details
    const originalEnd = res.end;
    res.end = function (
      chunk?: unknown,
      encoding?: unknown,
      cb?: unknown,
    ): Response {
      const responseTime = Date.now() - startTime;

      // Log the response
      req.app.locals.loggerService?.logRequest(
        req.method,
        req.url,
        res.statusCode,
        responseTime,
        req.get("User-Agent"),
        req.ip || req.connection.remoteAddress,
      );

      // Call the original end method and return the result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalEnd as any).call(this, chunk, encoding, cb);
    };

    next();
  };

  // Static method for use without DI
  static create(): (req: Request, res: Response, next: NextFunction) => void {
    const loggerService = new LoggerService();

    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();

      // Store logger service in app locals for access in res.end override
      req.app.locals.loggerService = loggerService;

      // Log the incoming request
      loggerService.debug("Incoming request", {
        method: req.method,
        url: req.url,
        userAgent: req.get("User-Agent"),
        ip: req.ip || req.connection.remoteAddress,
        headers: RequestLoggerMiddleware.sanitizeHeaders(req.headers),
      });

      // Override res.end to capture response details
      const originalEnd = res.end;
      res.end = function (
        chunk?: unknown,
        encoding?: unknown,
        cb?: unknown,
      ): Response {
        const responseTime = Date.now() - startTime;

        // Log the response
        loggerService.logRequest(
          req.method,
          req.url,
          res.statusCode,
          responseTime,
          req.get("User-Agent"),
          req.ip || req.connection.remoteAddress,
        );

        // Call the original end method and return the result
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalEnd as any).call(this, chunk, encoding, cb);
      };

      next();
    };
  }

  // Sanitize headers to remove sensitive information
  private sanitizeHeaders(
    headers: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
      "stripe-signature",
    ];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  // Static version of sanitize headers
  private static sanitizeHeaders(
    headers: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
      "stripe-signature",
    ];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = "[REDACTED]";
      }
    });

    return sanitized;
  }
}
