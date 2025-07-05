import { AuthException } from "../exceptions/auth.exception";

/**
 * Extracts Bearer token from authorization header
 * @param request Express request object or any object with headers
 * @returns Bearer token string or null if not found
 */
export function extractBearerToken(request: {
  headers?: { authorization?: string };
}): string | null {
  const authorization = request.headers?.authorization;

  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
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
    throw new AuthException("Missing or invalid authorization token", 401);
  }

  return token;
}
