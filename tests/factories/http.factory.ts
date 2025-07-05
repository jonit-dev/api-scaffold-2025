import { Request, Response } from "express";
import { vi } from "vitest";
import { HttpStatus } from "@/types/http-status";
import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ValidationException,
  InternalServerErrorException,
} from "@/exceptions/http-exceptions";

export class HttpFactory {
  static createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      params: {},
      query: {},
      body: {},
      headers: {},
      method: "GET",
      url: "/",
      ...overrides,
    };
  }

  static createMockResponse(): Partial<Response> {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      getHeader: vi.fn(),
      removeHeader: vi.fn(),
      locals: {},
    };
    return res;
  }

  static createAuthenticatedRequest(
    token: string,
    overrides: Partial<Request> = {},
  ): Partial<Request> {
    return this.createMockRequest({
      headers: {
        authorization: `Bearer ${token}`,
      },
      ...overrides,
    });
  }

  static createBadRequestException(
    message = "Bad request",
  ): BadRequestException {
    return new BadRequestException(message);
  }

  static createUnauthorizedException(
    message = "Unauthorized",
  ): UnauthorizedException {
    return new UnauthorizedException(message);
  }

  static createForbiddenException(message = "Forbidden"): ForbiddenException {
    return new ForbiddenException(message);
  }

  static createNotFoundException(message = "Not found"): NotFoundException {
    return new NotFoundException(message);
  }

  static createConflictException(message = "Conflict"): ConflictException {
    return new ConflictException(message);
  }

  static createValidationException(
    message = "Validation failed",
  ): ValidationException {
    return new ValidationException(message);
  }

  static createInternalServerErrorException(
    message = "Internal server error",
  ): InternalServerErrorException {
    return new InternalServerErrorException(message);
  }

  static createHttpException(
    status: HttpStatus,
    message: string,
  ): BadRequestException {
    return new BadRequestException(message);
  }

  static createErrorResponse(
    status: HttpStatus,
    message: string,
    details?: any,
  ) {
    return {
      success: false,
      error: {
        status,
        message,
        details,
        timestamp: new Date("2023-01-01T00:00:00.000Z"),
      },
    };
  }

  static createSuccessResponse(data: any, message = "Success") {
    return {
      success: true,
      data,
      message,
      timestamp: new Date("2023-01-01T00:00:00.000Z"),
    };
  }
}
