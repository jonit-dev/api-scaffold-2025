import { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../types/http-status";
import {
  ErrorHandlerRegistry,
  IErrorObject,
  logError,
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
  errors?: unknown;
}

export class GlobalErrorHandler {
  static handle(
    error: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
  ): void {
    if (res.headersSent) {
      logError(error as IErrorObject, req.path, new Date().toISOString());
      return;
    }

    const timestamp = new Date().toISOString();
    const path = req.path;

    const errorInfo = ErrorHandlerRegistry.handle(error);

    const errorResponse: IErrorResponse = {
      success: false,
      error: {
        status: errorInfo.statusCode,
        message:
          errorInfo.statusCode === HttpStatus.BadRequest && errorInfo.details
            ? "Invalid body, check 'errors' property for more info."
            : errorInfo.message,
        timestamp,
        path,
        ...(errorInfo.details !== undefined && { details: errorInfo.details }),
      },
    };

    if (errorInfo.statusCode === HttpStatus.BadRequest && errorInfo.details) {
      errorResponse.errors = errorInfo.details;
    }

    logError(error as IErrorObject, path, timestamp);

    res.status(errorInfo.statusCode).json(errorResponse);
  }
}

export default GlobalErrorHandler.handle;
