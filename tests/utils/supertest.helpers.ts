import request from "supertest";
import { Express } from "express";
import { HttpStatus } from "@/types/http-status";
import { expect } from "vitest";

export class SupertestHelpers {
  static createApiRequest(app: Express) {
    return request(app);
  }

  static async expectJsonResponse(
    response: request.Response,
    expectedStatus: number,
    expectedData?: any
  ) {
    expect(response.status).toBe(expectedStatus);
    expect(response.headers["content-type"]).toMatch(/json/);

    if (expectedData) {
      expect(response.body).toEqual(expectedData);
    }

    return response;
  }

  static async expectErrorResponse(
    response: request.Response,
    expectedStatus: number,
    expectedMessage?: string
  ) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toEqual(
      expect.objectContaining({
        status: expectedStatus,
        message: expectedMessage || expect.any(String),
        timestamp: expect.any(String),
        path: expect.any(String),
      })
    );

    return response;
  }

  static async expectSuccessResponse(
    response: request.Response,
    expectedData?: any,
    expectedMessage?: string
  ) {
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.body.success).toBe(true);

    if (expectedData) {
      expect(response.body.data).toEqual(expectedData);
    }

    if (expectedMessage) {
      expect(response.body.message).toBe(expectedMessage);
    }

    return response;
  }

  static async expectCreatedResponse(
    response: request.Response,
    expectedData?: any
  ) {
    expect(response.status).toBe(HttpStatus.Created);
    expect(response.body.success).toBe(true);

    if (expectedData) {
      expect(response.body.data).toEqual(expectedData);
    }

    return response;
  }

  static async expectNotFoundResponse(
    response: request.Response,
    expectedMessage?: string
  ) {
    return this.expectErrorResponse(
      response,
      HttpStatus.NotFound,
      expectedMessage
    );
  }

  static async expectBadRequestResponse(
    response: request.Response,
    expectedMessage?: string
  ) {
    return this.expectErrorResponse(
      response,
      HttpStatus.BadRequest,
      expectedMessage
    );
  }

  static async expectUnauthorizedResponse(
    response: request.Response,
    expectedMessage?: string
  ) {
    return this.expectErrorResponse(
      response,
      HttpStatus.Unauthorized,
      expectedMessage
    );
  }

  static async expectForbiddenResponse(
    response: request.Response,
    expectedMessage?: string
  ) {
    return this.expectErrorResponse(
      response,
      HttpStatus.Forbidden,
      expectedMessage
    );
  }

  static async expectConflictResponse(
    response: request.Response,
    expectedMessage?: string
  ) {
    return this.expectErrorResponse(
      response,
      HttpStatus.Conflict,
      expectedMessage
    );
  }

  static async expectValidationErrorResponse(
    response: request.Response,
    expectedMessage?: string
  ) {
    return this.expectErrorResponse(
      response,
      HttpStatus.UnprocessableEntity,
      expectedMessage
    );
  }

  static async expectInternalServerErrorResponse(
    response: request.Response,
    expectedMessage?: string
  ) {
    return this.expectErrorResponse(
      response,
      HttpStatus.InternalServerError,
      expectedMessage
    );
  }

  static createPostRequest(
    app: Express,
    endpoint: string,
    data: any,
    headers: any = {}
  ) {
    return request(app).post(endpoint).send(data).set(headers);
  }

  static createGetRequest(app: Express, endpoint: string, headers: any = {}) {
    return request(app).get(endpoint).set(headers);
  }

  static createPutRequest(
    app: Express,
    endpoint: string,
    data: any,
    headers: any = {}
  ) {
    return request(app).put(endpoint).send(data).set(headers);
  }

  static createPatchRequest(
    app: Express,
    endpoint: string,
    data: any,
    headers: any = {}
  ) {
    return request(app).patch(endpoint).send(data).set(headers);
  }

  static createDeleteRequest(
    app: Express,
    endpoint: string,
    headers: any = {}
  ) {
    return request(app).delete(endpoint).set(headers);
  }

  static createAuthenticatedRequest(
    app: Express,
    method: string,
    endpoint: string,
    token: string,
    data?: any
  ) {
    const methodLower = method.toLowerCase();
    let req: request.Test;

    switch (methodLower) {
      case "get":
        req = request(app).get(endpoint);
        break;
      case "post":
        req = request(app).post(endpoint);
        break;
      case "put":
        req = request(app).put(endpoint);
        break;
      case "patch":
        req = request(app).patch(endpoint);
        break;
      case "delete":
        req = request(app).delete(endpoint);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    req.set("Authorization", `Bearer ${token}`);

    if (data && ["post", "put", "patch"].includes(method.toLowerCase())) {
      return req.send(data);
    }

    return req;
  }

  static async expectPaginatedResponse(
    response: request.Response,
    expectedData?: any
  ) {
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        data: expect.any(Array),
        pagination: expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          totalPages: expect.any(Number),
          hasNextPage: expect.any(Boolean),
          hasPreviousPage: expect.any(Boolean),
        }),
      })
    );

    if (expectedData) {
      expect(response.body.data.data).toEqual(expectedData);
    }

    return response;
  }

  static async expectEmptyPaginatedResponse(response: request.Response) {
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        data: [],
        pagination: expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number),
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: expect.any(Boolean),
        }),
      })
    );

    return response;
  }
}
