import { Request, Response, NextFunction } from "express";
import { ValidationError } from "class-validator";
import { HttpError } from "routing-controllers";
import { HttpStatus } from "../types/http-status";
import {
  HttpException,
  UnauthorizedException,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
} from "../exceptions/http-exceptions";

export interface IErrorResponse {
  success: false;
  error: {
    status: HttpStatus;
    message: string;
    timestamp: string;
    path: string;
    details?: unknown;
  };
}

export class GlobalErrorHandler {
  static handle(
    error: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
  ): void {
    const timestamp = new Date().toISOString();
    const path = req.path;
    let statusCode = HttpStatus.InternalServerError;
    let message = "Internal Server Error";
    let details: unknown = undefined;

    // Type guard for error-like objects
    const errorObj = error as {
      name?: string;
      message?: string;
      statusCode?: number;
      status?: number;
      code?: string;
      details?: unknown;
      stack?: string;
    };

    // Handle custom HttpException
    if (error instanceof HttpException) {
      statusCode = error.statusCode;
      message = error.message;
      details = error.details;
    }
    // Handle routing-controllers HttpError
    else if (error instanceof HttpError) {
      statusCode = error.httpCode as HttpStatus;
      message = error.message;
    }
    // Handle validation errors
    else if (Array.isArray(error) && error[0] instanceof ValidationError) {
      statusCode = HttpStatus.BadRequest;
      message = "Validation failed";
      details = error.map((err: ValidationError) => ({
        property: err.property,
        value: err.value,
        constraints: err.constraints,
      }));
    }
    // Handle class-validator ValidationError
    else if (error instanceof ValidationError) {
      statusCode = HttpStatus.BadRequest;
      message = "Validation failed";
      details = {
        property: error.property,
        value: error.value,
        constraints: error.constraints,
      };
    }
    // Handle JWT errors - convert to custom exceptions
    else if (errorObj.name === "JsonWebTokenError") {
      const jwtError = new UnauthorizedException("Invalid token");
      statusCode = jwtError.statusCode;
      message = jwtError.message;
    } else if (errorObj.name === "TokenExpiredError") {
      const jwtError = new UnauthorizedException("Token expired");
      statusCode = jwtError.statusCode;
      message = jwtError.message;
    }
    // Handle database errors - convert to custom exceptions
    else if (errorObj.code === "ECONNREFUSED") {
      const dbError = new ServiceUnavailableException(
        "Database connection failed",
      );
      statusCode = dbError.statusCode;
      message = dbError.message;
    }
    // Handle Supabase errors - convert to custom exceptions
    else if (errorObj.code === "PGRST116") {
      const supabaseError = new NotFoundException("Resource not found");
      statusCode = supabaseError.statusCode;
      message = supabaseError.message;
    } else if (errorObj.code === "PGRST204") {
      const supabaseError = new BadRequestException(
        "Invalid request parameters",
      );
      statusCode = supabaseError.statusCode;
      message = supabaseError.message;
    }
    // Handle other known errors
    else if (errorObj.statusCode || errorObj.status) {
      statusCode = (errorObj.statusCode || errorObj.status) as HttpStatus;
      message = errorObj.message || message;
    }

    const errorResponse: IErrorResponse = {
      success: false,
      error: {
        status: statusCode,
        message,
        timestamp,
        path,
        ...(details !== undefined && { details }),
      },
    };

    // Log error details for debugging
    if (statusCode >= HttpStatus.InternalServerError) {
      console.error("🔥 Internal Server Error:", {
        error: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
        path,
        timestamp,
      });
    } else {
      console.warn("⚠️  Client Error:", {
        error: errorObj.name,
        message: errorObj.message,
        path,
        timestamp,
      });
    }

    res.status(statusCode).json(errorResponse);
  }
}

export default GlobalErrorHandler.handle;
