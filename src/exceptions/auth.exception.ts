import { HttpStatus } from "../types/http-status";

export class AuthException extends Error {
  public readonly statusCode: HttpStatus;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.Unauthorized,
    code?: string,
  ) {
    super(message);
    this.name = "AuthException";
    this.statusCode = statusCode;
    this.code = code || "AUTH_ERROR";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidCredentialsException extends AuthException {
  constructor(message = "Invalid credentials") {
    super(message, HttpStatus.Unauthorized, "INVALID_CREDENTIALS");
  }
}

export class AuthUnauthorizedException extends AuthException {
  constructor(message = "Unauthorized access") {
    super(message, HttpStatus.Unauthorized, "UNAUTHORIZED");
  }
}

export class AuthForbiddenException extends AuthException {
  constructor(message = "Forbidden access") {
    super(message, HttpStatus.Forbidden, "FORBIDDEN");
  }
}

export class TokenExpiredException extends AuthException {
  constructor(message = "Token has expired") {
    super(message, HttpStatus.Unauthorized, "TOKEN_EXPIRED");
  }
}

export class InvalidTokenException extends AuthException {
  constructor(message = "Invalid token") {
    super(message, HttpStatus.Unauthorized, "INVALID_TOKEN");
  }
}

export class AccountSuspendedException extends AuthException {
  constructor(message = "Account is suspended") {
    super(message, HttpStatus.Forbidden, "ACCOUNT_SUSPENDED");
  }
}

export class EmailNotVerifiedException extends AuthException {
  constructor(message = "Email address is not verified") {
    super(message, HttpStatus.Forbidden, "EMAIL_NOT_VERIFIED");
  }
}

export class PasswordResetException extends AuthException {
  constructor(message = "Password reset failed") {
    super(message, HttpStatus.BadRequest, "PASSWORD_RESET_FAILED");
  }
}

export class UserNotFoundException extends AuthException {
  constructor(message = "User not found") {
    super(message, HttpStatus.NotFound, "USER_NOT_FOUND");
  }
}
