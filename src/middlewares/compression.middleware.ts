import { Request, Response, NextFunction } from "express";
import compression from "compression";
import { Container } from "typedi";
import { LoggerService } from "../services/logger.service";

export class CompressionMiddleware {
  static create(): ReturnType<typeof compression> {
    return compression({
      // Only compress responses that are larger than this threshold
      threshold: 1024,

      // Compression level (0-9, where 6 is default)
      level: 6,

      // Compression strategy (use raw zlib constant)
      strategy: 0,

      // Filter function to determine what should be compressed
      filter: (req: Request, res: Response) => {
        // Don't compress if the client doesn't accept gzip
        if (!req.headers["accept-encoding"]?.includes("gzip")) {
          return false;
        }

        // Don't compress if already compressed
        if (res.getHeader("content-encoding")) {
          return false;
        }

        // Use compression's default filter
        return compression.filter(req, res);
      },

      // Memory level (1-9, where 8 is default)
      memLevel: 8,

      // Window bits (9-15, where 15 is default)
      windowBits: 15,
    });
  }

  static log(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const originalJson = res.json;

      // Track response size
      res.send = function (body: unknown): Response {
        const size = Buffer.byteLength(String(body || ""), "utf8");
        const logger = Container.get(LoggerService);
        logger.debug(`Response size: ${size} bytes`, {
          path: req.path,
          method: req.method,
          compressed: !!res.getHeader("content-encoding"),
        });
        return originalSend.call(this, body);
      };

      res.json = function (obj: unknown): Response {
        const size = Buffer.byteLength(JSON.stringify(obj || {}), "utf8");
        const logger = Container.get(LoggerService);
        logger.debug(`JSON response size: ${size} bytes`, {
          path: req.path,
          method: req.method,
          compressed: !!res.getHeader("content-encoding"),
        });
        return originalJson.call(this, obj);
      };

      next();
    };
  }
}
