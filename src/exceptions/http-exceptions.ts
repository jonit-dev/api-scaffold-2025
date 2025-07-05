import { HttpStatus } from '../types/http-status';

export abstract class HttpException extends Error {
  public readonly statusCode: HttpStatus;
  public readonly message: string;
  public readonly details?: any;

  constructor(statusCode: HttpStatus, message: string, details?: any) {
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
  constructor(message: string = 'Bad Request', details?: any) {
    super(HttpStatus.BadRequest, message, details);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(HttpStatus.Unauthorized, message, details);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden', details?: any) {
    super(HttpStatus.Forbidden, message, details);
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string = 'Not Found', details?: any) {
    super(HttpStatus.NotFound, message, details);
  }
}

export class MethodNotAllowedException extends HttpException {
  constructor(message: string = 'Method Not Allowed', details?: any) {
    super(HttpStatus.MethodNotAllowed, message, details);
  }
}

export class NotAcceptableException extends HttpException {
  constructor(message: string = 'Not Acceptable', details?: any) {
    super(HttpStatus.NotAcceptable, message, details);
  }
}

export class RequestTimeoutException extends HttpException {
  constructor(message: string = 'Request Timeout', details?: any) {
    super(HttpStatus.RequestTimeout, message, details);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string = 'Conflict', details?: any) {
    super(HttpStatus.Conflict, message, details);
  }
}

export class GoneException extends HttpException {
  constructor(message: string = 'Gone', details?: any) {
    super(HttpStatus.Gone, message, details);
  }
}

export class PayloadTooLargeException extends HttpException {
  constructor(message: string = 'Payload Too Large', details?: any) {
    super(HttpStatus.PayloadTooLarge, message, details);
  }
}

export class UnsupportedMediaTypeException extends HttpException {
  constructor(message: string = 'Unsupported Media Type', details?: any) {
    super(HttpStatus.UnsupportedMediaType, message, details);
  }
}

export class UnprocessableEntityException extends HttpException {
  constructor(message: string = 'Unprocessable Entity', details?: any) {
    super(HttpStatus.UnprocessableEntity, message, details);
  }
}

export class TooManyRequestsException extends HttpException {
  constructor(message: string = 'Too Many Requests', details?: any) {
    super(HttpStatus.TooManyRequests, message, details);
  }
}

// 5xx Server Errors
export class InternalServerErrorException extends HttpException {
  constructor(message: string = 'Internal Server Error', details?: any) {
    super(HttpStatus.InternalServerError, message, details);
  }
}

export class NotImplementedException extends HttpException {
  constructor(message: string = 'Not Implemented', details?: any) {
    super(HttpStatus.NotImplemented, message, details);
  }
}

export class BadGatewayException extends HttpException {
  constructor(message: string = 'Bad Gateway', details?: any) {
    super(HttpStatus.BadGateway, message, details);
  }
}

export class ServiceUnavailableException extends HttpException {
  constructor(message: string = 'Service Unavailable', details?: any) {
    super(HttpStatus.ServiceUnavailable, message, details);
  }
}

export class GatewayTimeoutException extends HttpException {
  constructor(message: string = 'Gateway Timeout', details?: any) {
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