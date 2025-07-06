import { AuthException } from "../exceptions/auth.exception";
import { HttpStatus } from "../types/http-status";

/**
 * Extracts Bearer token from authorization header
 * @param request Express request object or any object with headers
 * @returns Bearer token string or null if not found
 */
export function extractBearerToken(request: {
  headers?: { authorization?: string };
}): string | null {
  const authorization = request.headers?.authorization?.trim();

  if (!authorization) {
    return null;
  }

  const parts = authorization.split(/\s+/); // Split by one or more whitespace characters

  if (parts.length !== 2) {
    return null;
  }

  const [type, token] = parts;

  if (type.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

/**
 * Extracts Bearer token from authorization header and throws if not found
 * @param request Express request object or any object with headers
 * @returns Bearer token string
 * @throws AuthException if token is missing or invalid
 */
export function extractBearerTokenOrThrow(request: {
  headers?: { authorization?: string };
}): string {
  const token = extractBearerToken(request);

  if (!token) {
    throw new AuthException(
      "Missing or invalid authorization token",
      HttpStatus.Unauthorized,
    );
  }

  return token;
}
