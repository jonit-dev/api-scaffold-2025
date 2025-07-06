import { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../types/http-status";

export class JSONParserMiddleware {
  /**
   * Global error handler for JSON parsing errors
   * This catches JSON syntax errors and provides helpful feedback
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
        // Clean up the error message to make it more user-friendly
        let cleanMessage = error.message;
        let hint = "Check your JSON syntax";

        // Provide specific hints for common issues
        if (error.message.includes("Expected double-quoted property name")) {
          hint =
            "You likely have a trailing comma in your JSON. Remove any commas after the last property.";
        } else if (error.message.includes("Unexpected token")) {
          hint =
            "Common issues: trailing commas, unquoted keys, or invalid escape sequences";
        }

        res.status(HttpStatus.BadRequest).json({
          success: false,
          error: {
            status: HttpStatus.BadRequest,
            message: "Invalid JSON format in request body",
            details: cleanMessage,
            hint: hint,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      // Pass other errors to the next error handler
      next(error);
    };
  }

  /**
   * Helper method to clean common JSON syntax issues
   * This can be used if you want to preprocess JSON strings
   */
  static cleanJSON(jsonString: string): string {
    return (
      jsonString
        // Remove trailing commas before closing braces
        .replace(/,(\s*})/g, "$1")
        // Remove trailing commas before closing brackets
        .replace(/,(\s*])/g, "$1")
        // Remove multiple consecutive commas
        .replace(/,+/g, ",")
        // Remove commas at the start of objects/arrays
        .replace(/{\s*,/g, "{")
        .replace(/\[\s*,/g, "[")
        // Remove trailing commas at the end of the string
        .replace(/,(\s*)$/, "$1")
    );
  }
}
