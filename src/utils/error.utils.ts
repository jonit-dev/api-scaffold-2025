import { ValidationError } from "class-validator";
import { HttpError } from "routing-controllers";
import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "../exceptions/http-exceptions";
import { HttpStatus } from "../types/http-status";

export interface IErrorInfo {
  statusCode: HttpStatus;
  message: string;
  details?: unknown;
}

export interface IErrorObject {
  name?: string;
  message?: string;
  statusCode?: number;
  status?: number;
  code?: string;
  details?: unknown;
  stack?: string;
  httpCode?: number;
  errors?: ValidationError[];
}

/**
 * Error handler registry for different error types
 */
export class ErrorHandlerRegistry {
  private static handlers: Array<{
    matcher: (error: unknown) => boolean;
    handler: (error: unknown) => IErrorInfo;
  }> = [];

  static register(
    matcher: (error: unknown) => boolean,
    handler: (error: unknown) => IErrorInfo,
  ): void {
    this.handlers.push({ matcher, handler });
  }

  static handle(error: unknown): IErrorInfo {
    for (const { matcher, handler } of this.handlers) {
      if (matcher(error)) {
        return handler(error);
      }
    }
    // Default fallback
    return {
      statusCode: HttpStatus.InternalServerError,
      message: "Internal Server Error",
    };
  }
}

// Register routing-controllers HttpError handler (must be first)
ErrorHandlerRegistry.register(
  (error): error is HttpError => error instanceof HttpError,
  (error) => {
    const httpError = error as HttpError;
    return {
      statusCode: httpError.httpCode as HttpStatus,
      message: httpError.message,
      // Include validation errors if available
      details: (httpError as IErrorObject).errors || undefined,
    };
  },
);

// Register custom HttpException handler
ErrorHandlerRegistry.register(
  (error): error is HttpException => error instanceof HttpException,
  (error) => {
    const httpError = error as HttpException;
    return {
      statusCode: httpError.statusCode,
      message: httpError.message,
      details: httpError.details,
    };
  },
);

// Register validation error handlers
ErrorHandlerRegistry.register(
  (error): error is ValidationError[] =>
    Array.isArray(error) && error[0] instanceof ValidationError,
  (error) => {
    const validationErrors = error as ValidationError[];
    return {
      statusCode: HttpStatus.BadRequest,
      message: "Validation failed",
      details: validationErrors.map((err) => ({
        property: err.property,
        value: err.value,
        constraints: err.constraints,
      })),
    };
  },
);

ErrorHandlerRegistry.register(
  (error): error is ValidationError => error instanceof ValidationError,
  (error) => {
    const validationError = error as ValidationError;
    return {
      statusCode: HttpStatus.BadRequest,
      message: "Validation failed",
      details: {
        property: validationError.property,
        value: validationError.value,
        constraints: validationError.constraints,
      },
    };
  },
);

// Handle errors with validation errors property (routing-controllers format)
ErrorHandlerRegistry.register(
  (error) => {
    const errorObj = error as IErrorObject;
    return !!(errorObj.errors && Array.isArray(errorObj.errors));
  },
  (error) => {
    const errorObj = error as IErrorObject;
    return {
      statusCode: HttpStatus.BadRequest,
      message: "Validation failed",
      details: errorObj.errors?.map((err) => ({
        property: err.property,
        value: err.value,
        constraints: err.constraints,
      })),
    };
  },
);

// JWT Error handlers
ErrorHandlerRegistry.register(
  (error) => (error as IErrorObject).name === "JsonWebTokenError",
  () => {
    const jwtError = new UnauthorizedException("Invalid token");
    return {
      statusCode: jwtError.statusCode,
      message: jwtError.message,
    };
  },
);

ErrorHandlerRegistry.register(
  (error) => (error as IErrorObject).name === "TokenExpiredError",
  () => {
    const jwtError = new UnauthorizedException("Token expired");
    return {
      statusCode: jwtError.statusCode,
      message: jwtError.message,
    };
  },
);

// Database Error handlers
ErrorHandlerRegistry.register(
  (error) => (error as IErrorObject).code === "ECONNREFUSED",
  () => {
    const dbError = new ServiceUnavailableException(
      "Database connection failed",
    );
    return {
      statusCode: dbError.statusCode,
      message: dbError.message,
    };
  },
);

// Supabase Error handlers
ErrorHandlerRegistry.register(
  (error) => (error as IErrorObject).code === "PGRST116",
  () => {
    const supabaseError = new NotFoundException("Resource not found");
    return {
      statusCode: supabaseError.statusCode,
      message: supabaseError.message,
    };
  },
);

ErrorHandlerRegistry.register(
  (error) => (error as IErrorObject).code === "PGRST204",
  () => {
    const supabaseError = new BadRequestException("Invalid request parameters");
    return {
      statusCode: supabaseError.statusCode,
      message: supabaseError.message,
    };
  },
);

// Generic error with status code
ErrorHandlerRegistry.register(
  (error) => {
    const errorObj = error as IErrorObject;
    return !!(errorObj.statusCode || errorObj.status || errorObj.httpCode);
  },
  (error) => {
    const errorObj = error as IErrorObject;
    return {
      statusCode: (errorObj.statusCode ||
        errorObj.status ||
        errorObj.httpCode) as HttpStatus,
      message: errorObj.message || "Internal Server Error",
    };
  },
);

export function logError(
  error: IErrorObject,
  path: string,
  timestamp: string,
): void {
  const statusCode =
    error.statusCode ||
    error.status ||
    error.httpCode ||
    HttpStatus.InternalServerError;

  // Use console here since this utility is called before logger might be initialized
  if (statusCode >= HttpStatus.InternalServerError) {
    console.error("🔥 Internal Server Error:", {
      error: error.name,
      message: error.message,
      stack: error.stack,
      path,
      timestamp,
    });
  } else if (statusCode === HttpStatus.BadRequest) {
    // Don't log validation errors as warnings - they're expected client errors
    console.debug("🔍 Validation Error:", {
      error: error.name,
      message: error.message,
      path,
      timestamp,
    });
  } else {
    console.warn("⚠️  Client Error:", {
      error: error.name,
      message: error.message,
      path,
      timestamp,
    });
  }
}
