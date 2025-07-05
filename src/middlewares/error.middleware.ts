import { Request, Response, NextFunction } from "express";
import { HttpStatus } from "../types/http-status";
import {
  ErrorHandlerRegistry,
  logError,
  IErrorObject,
} from "../utils/error.utils";

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

    // Use the error handler registry to get error info
    const errorInfo = ErrorHandlerRegistry.handle(error);

    // Create error response in expected format
    const errorResponse: IErrorResponse = {
      success: false,
      error: {
        status: errorInfo.statusCode,
        message: errorInfo.message,
        timestamp,
        path,
        ...(errorInfo.details !== undefined && { details: errorInfo.details }),
      },
    };

    // Log error details for debugging
    logError(error as IErrorObject, path, timestamp);

    res.status(errorInfo.statusCode).json(errorResponse);
  }
}

export default GlobalErrorHandler.handle;
