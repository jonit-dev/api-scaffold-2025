/**
 * Standard API response interface
 */
export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
  error?: string;
  errors?: string[];
}

/**
 * Creates a success response with standardized format
 * @param data Response data
 * @param message Optional success message
 * @returns Formatted success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string,
): IApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates an error response with standardized format
 * @param error Error message
 * @param errors Optional array of error details
 * @returns Formatted error response
 */
export function createErrorResponse(
  error: string,
  errors?: string[],
): IApiResponse {
  return {
    success: false,
    error,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a response with both success and error possibility
 * @param success Whether the operation was successful
 * @param data Response data (for success)
 * @param message Success message or error message
 * @param errors Optional array of error details
 * @returns Formatted response
 */
export function createResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  errors?: string[],
): IApiResponse<T> {
  const response: IApiResponse<T> = {
    success,
    timestamp: new Date().toISOString(),
  };

  if (success) {
    response.data = data;
    response.message = message;
  } else {
    response.error = message;
    response.errors = errors;
  }

  return response;
}
