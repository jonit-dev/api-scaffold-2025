import { HttpStatus } from "../types/http-status";

// Type for exception details
type ExceptionDetails = Record<string, unknown> | string | null;

export abstract class HttpException extends Error {
  public readonly statusCode: HttpStatus;
  public readonly message: string;
  public readonly details?: ExceptionDetails;

  constructor(
    statusCode: HttpStatus,
    message: string,
    details?: ExceptionDetails,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 4xx Client Errors
export class BadRequestException extends HttpException {
  constructor(message: string = "Bad Request", details?: ExceptionDetails) {
    super(HttpStatus.BadRequest, message, details);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string = "Unauthorized", details?: ExceptionDetails) {
    super(HttpStatus.Unauthorized, message, details);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string = "Forbidden", details?: ExceptionDetails) {
    super(HttpStatus.Forbidden, message, details);
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string = "Not Found", details?: ExceptionDetails) {
    super(HttpStatus.NotFound, message, details);
  }
}

export class MethodNotAllowedException extends HttpException {
  constructor(
    message: string = "Method Not Allowed",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.MethodNotAllowed, message, details);
  }
}

export class NotAcceptableException extends HttpException {
  constructor(message: string = "Not Acceptable", details?: ExceptionDetails) {
    super(HttpStatus.NotAcceptable, message, details);
  }
}

export class RequestTimeoutException extends HttpException {
  constructor(message: string = "Request Timeout", details?: ExceptionDetails) {
    super(HttpStatus.RequestTimeout, message, details);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string = "Conflict", details?: ExceptionDetails) {
    super(HttpStatus.Conflict, message, details);
  }
}

export class GoneException extends HttpException {
  constructor(message: string = "Gone", details?: ExceptionDetails) {
    super(HttpStatus.Gone, message, details);
  }
}

export class PayloadTooLargeException extends HttpException {
  constructor(
    message: string = "Payload Too Large",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.PayloadTooLarge, message, details);
  }
}

export class UnsupportedMediaTypeException extends HttpException {
  constructor(
    message: string = "Unsupported Media Type",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.UnsupportedMediaType, message, details);
  }
}

export class UnprocessableEntityException extends HttpException {
  constructor(
    message: string = "Unprocessable Entity",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.UnprocessableEntity, message, details);
  }
}

export class ValidationException extends HttpException {
  constructor(
    message: string = "Validation Error",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.UnprocessableEntity, message, details);
  }
}

export class TooManyRequestsException extends HttpException {
  constructor(
    message: string = "Too Many Requests",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.TooManyRequests, message, details);
  }
}

// 5xx Server Errors
export class InternalServerErrorException extends HttpException {
  constructor(
    message: string = "Internal Server Error",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.InternalServerError, message, details);
  }
}

export class NotImplementedException extends HttpException {
  constructor(message: string = "Not Implemented", details?: ExceptionDetails) {
    super(HttpStatus.NotImplemented, message, details);
  }
}

export class BadGatewayException extends HttpException {
  constructor(message: string = "Bad Gateway", details?: ExceptionDetails) {
    super(HttpStatus.BadGateway, message, details);
  }
}

export class ServiceUnavailableException extends HttpException {
  constructor(
    message: string = "Service Unavailable",
    details?: ExceptionDetails,
  ) {
    super(HttpStatus.ServiceUnavailable, message, details);
  }
}

export class GatewayTimeoutException extends HttpException {
  constructor(message: string = "Gateway Timeout", details?: ExceptionDetails) {
    super(HttpStatus.GatewayTimeout, message, details);
  }
}

// Convenience aliases for common use cases
export class BadRequest extends BadRequestException {}
export class Unauthorized extends UnauthorizedException {}
export class Forbidden extends ForbiddenException {}
export class NotFound extends NotFoundException {}
export class Conflict extends ConflictException {}
export class UnprocessableEntity extends UnprocessableEntityException {}
export class InternalServerError extends InternalServerErrorException {}
export class ServiceUnavailable extends ServiceUnavailableException {}
