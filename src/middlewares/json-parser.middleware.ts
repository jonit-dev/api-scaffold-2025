import { NextFunction, Request, Response } from "express";
import { jsonrepair } from "jsonrepair";
import { HttpStatus } from "../types/http-status";

export class JSONParserMiddleware {
  /**
   * Middleware that automatically fixes common JSON syntax issues using jsonrepair library
   * This runs before the built-in JSON parser and corrects problems like trailing commas
   */
  static createAutoCorrector() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Only process requests with JSON content type
      if (!req.is("application/json")) {
        return next();
      }

      let rawBody = "";
      const chunks: Buffer[] = [];

      // Intercept the raw body data
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on("end", () => {
        try {
          // Reconstruct the raw body
          rawBody = Buffer.concat(chunks).toString("utf8");

          if (rawBody.trim()) {
            // Use jsonrepair to automatically fix common JSON issues
            const repairedJson = jsonrepair(rawBody);

            // Parse the repaired JSON
            const parsedBody = JSON.parse(repairedJson);

            // Set the parsed body on the request
            req.body = parsedBody;

            // Mark that we've already parsed the body
            (req as Request & { _body?: boolean })._body = true;

            // Log successful auto-correction if the JSON was modified
            if (repairedJson !== rawBody) {
              console.log(`🔧 Auto-corrected JSON for ${req.path}`);
            }
          }

          next();
        } catch (error) {
          // If jsonrepair couldn't fix it, provide helpful error message
          res.status(HttpStatus.BadRequest).json({
            success: false,
            error: {
              status: HttpStatus.BadRequest,
              message: "Invalid JSON format in request body",
              details:
                error instanceof Error
                  ? error.message
                  : "Unknown JSON parsing error",
              hint: "The JSON syntax is too malformed to auto-correct. Please check your request body format.",
              originalBody:
                rawBody.substring(0, 200) + (rawBody.length > 200 ? "..." : ""),
              timestamp: new Date().toISOString(),
              path: req.path,
            },
          });
        }
      });

      req.on("error", (error) => {
        res.status(HttpStatus.BadRequest).json({
          success: false,
          error: {
            status: HttpStatus.BadRequest,
            message: "Error reading request body",
            details: error.message,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
      });
    };
  }

  /**
   * Global error handler for any remaining JSON parsing errors
   * This is a fallback in case the auto-corrector doesn't catch everything
   */
  static createErrorHandler() {
    return (
      error: Error,
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      // Check if this is a JSON parsing error
      if (
        error instanceof SyntaxError &&
        "body" in error &&
        (error.message.includes("JSON") ||
          error.message.includes("Unexpected token") ||
          error.message.includes("Expected double-quoted property name"))
      ) {
        res.status(HttpStatus.BadRequest).json({
          success: false,
          error: {
            status: HttpStatus.BadRequest,
            message: "JSON parsing error (fallback handler)",
            details: error.message,
            hint: "This error occurred despite auto-correction attempts. Please check your JSON syntax.",
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      // Not a JSON parsing error, pass to next error handler
      next(error);
    };
  }

  /**
   * Helper method to clean JSON syntax issues using jsonrepair library
   */
  static cleanJSON(jsonString: string): string {
    return jsonrepair(jsonString);
  }
}
