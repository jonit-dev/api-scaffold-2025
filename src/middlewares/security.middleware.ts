import helmet from "helmet";
import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";
import { Container } from "typedi";
import { LoggerService } from "../services/logger.service";

export class SecurityMiddleware {
  static create(): ReturnType<typeof helmet> {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrc: ["'self'", "https:"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'", "https:", "wss:"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
        // Allow CSP to be disabled in development
        reportOnly: config.server.environment === "development",
      },

      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: false, // Disable for API usage

      // Cross-Origin Opener Policy
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },

      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: { policy: "cross-origin" },

      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },

      // Frame Options (X-Frame-Options)
      frameguard: { action: "deny" },

      // Hide Powered-By header
      hidePoweredBy: true,

      // HTTP Strict Transport Security (HSTS)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      // Internet Explorer, restrict untrusted HTML
      ieNoOpen: true,

      // X-Content-Type-Options
      noSniff: true,

      // Origin Agent Cluster
      originAgentCluster: true,

      // Permissions Policy (formerly Feature Policy)
      permittedCrossDomainPolicies: false,

      // Referrer Policy
      referrerPolicy: { policy: "no-referrer" },

      // X-XSS-Protection
      xssFilter: true,
    });
  }

  static apiHeaders(): (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // API-specific security headers
      res.setHeader("X-API-Version", "1.0.0");
      res.setHeader("X-Request-ID", req.headers["x-request-id"] || "unknown");
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Remove server identification
      res.removeHeader("X-Powered-By");
      res.removeHeader("Server");

      const logger = Container.get(LoggerService);
      logger.debug("Applied API security headers", {
        path: req.path,
        method: req.method,
        userAgent: req.headers["user-agent"],
      });

      next();
    };
  }

  static webhookHeaders(): (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // Less restrictive for webhooks (like Stripe)
      if (req.path.includes("/webhooks/")) {
        res.removeHeader("X-Frame-Options");
        res.removeHeader("Content-Security-Policy");

        const logger = Container.get(LoggerService);
        logger.debug("Applied webhook security headers", {
          path: req.path,
          method: req.method,
          signature: req.headers["stripe-signature"] ? "present" : "missing",
        });
      }

      next();
    };
  }

  static validateHeaders(): (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // Validate critical security headers on incoming requests
      const userAgent = req.headers["user-agent"];

      // Log potentially suspicious requests
      if (!userAgent || userAgent.length < 10) {
        const logger = Container.get(LoggerService);
        logger.warn("Suspicious request with invalid user agent", {
          userAgent,
          ip: req.ip,
          path: req.path,
        });
      }

      // Check for common attack patterns in headers
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
      ];

      const headerValues = Object.values(req.headers).join(" ");
      const hasSuspiciousContent = suspiciousPatterns.some((pattern) =>
        pattern.test(headerValues),
      );

      if (hasSuspiciousContent) {
        const logger = Container.get(LoggerService);
        logger.warn("Suspicious request detected", {
          headers: req.headers,
          ip: req.ip,
          path: req.path,
        });
      }

      next();
    };
  }
}
