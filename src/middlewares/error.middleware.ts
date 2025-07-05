import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'class-validator';
import { HttpError } from 'routing-controllers';
import { HttpStatus } from '../types/http-status';
import { 
  HttpException, 
  UnauthorizedException, 
  ServiceUnavailableException, 
  NotFoundException, 
  BadRequestException 
} from '../exceptions/http-exceptions';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: HttpStatus;
  timestamp: string;
  path: string;
  details?: any;
}

export class GlobalErrorHandler {
  static handle(error: any, req: Request, res: Response, _next: NextFunction): void {
    const timestamp = new Date().toISOString();
    const path = req.path;
    let statusCode = HttpStatus.InternalServerError;
    let message = 'Internal Server Error';
    let details: any = undefined;

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
      message = 'Validation failed';
      details = error.map((err: ValidationError) => ({
        property: err.property,
        value: err.value,
        constraints: err.constraints,
      }));
    }
    // Handle class-validator ValidationError
    else if (error instanceof ValidationError) {
      statusCode = HttpStatus.BadRequest;
      message = 'Validation failed';
      details = {
        property: error.property,
        value: error.value,
        constraints: error.constraints,
      };
    }
    // Handle JWT errors - convert to custom exceptions
    else if (error.name === 'JsonWebTokenError') {
      const jwtError = new UnauthorizedException('Invalid token');
      statusCode = jwtError.statusCode;
      message = jwtError.message;
    }
    else if (error.name === 'TokenExpiredError') {
      const jwtError = new UnauthorizedException('Token expired');
      statusCode = jwtError.statusCode;
      message = jwtError.message;
    }
    // Handle database errors - convert to custom exceptions
    else if (error.code === 'ECONNREFUSED') {
      const dbError = new ServiceUnavailableException('Database connection failed');
      statusCode = dbError.statusCode;
      message = dbError.message;
    }
    // Handle Supabase errors - convert to custom exceptions
    else if (error.code === 'PGRST116') {
      const supabaseError = new NotFoundException('Resource not found');
      statusCode = supabaseError.statusCode;
      message = supabaseError.message;
    }
    else if (error.code === 'PGRST204') {
      const supabaseError = new BadRequestException('Invalid request parameters');
      statusCode = supabaseError.statusCode;
      message = supabaseError.message;
    }
    // Handle other known errors
    else if (error.statusCode || error.status) {
      statusCode = error.statusCode || error.status;
      message = error.message || message;
    }

    const errorResponse: ErrorResponse = {
      error: error.name || 'UnknownError',
      message,
      statusCode,
      timestamp,
      path,
      ...(details && { details }),
    };

    // Log error details for debugging
    if (statusCode >= HttpStatus.InternalServerError) {
      console.error('🔥 Internal Server Error:', {
        error: error.name,
        message: error.message,
        stack: error.stack,
        path,
        timestamp,
      });
    } else {
      console.warn('⚠️  Client Error:', {
        error: error.name,
        message: error.message,
        path,
        timestamp,
      });
    }

    res.status(statusCode).json(errorResponse);
  }
}

export default GlobalErrorHandler.handle;