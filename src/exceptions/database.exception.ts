import { HttpException } from "./http-exceptions";
import { HttpStatus } from "../types/http-status";

// Supabase error structure
interface ISupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export class DatabaseException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.InternalServerError,
  ) {
    super(statusCode, message);
    this.name = "DatabaseException";
  }
}

export class DatabaseConnectionException extends DatabaseException {
  constructor(message: string = "Database connection failed") {
    super(message, HttpStatus.ServiceUnavailable);
    this.name = "DatabaseConnectionException";
  }
}

export class DatabaseQueryException extends DatabaseException {
  constructor(message: string = "Database query failed") {
    super(message, HttpStatus.BadRequest);
    this.name = "DatabaseQueryException";
  }
}

export class DatabaseConstraintException extends DatabaseException {
  constructor(message: string = "Database constraint violation") {
    super(message, HttpStatus.Conflict);
    this.name = "DatabaseConstraintException";
  }
}

export class DatabaseNotFoundException extends DatabaseException {
  constructor(message: string = "Resource not found") {
    super(message, HttpStatus.NotFound);
    this.name = "DatabaseNotFoundException";
  }
}

export class DatabaseValidationException extends DatabaseException {
  constructor(message: string = "Database validation failed") {
    super(message, HttpStatus.UnprocessableEntity);
    this.name = "DatabaseValidationException";
  }
}

// Map Supabase error codes to specific exceptions
export function mapSupabaseError(error: ISupabaseError): DatabaseException {
  const { code, message } = error;

  switch (code) {
    case "PGRST116":
      return new DatabaseNotFoundException(message || "Resource not found");
    case "PGRST204":
      return new DatabaseQueryException(message || "Invalid query parameters");
    case "PGRST301":
      return new DatabaseQueryException(message || "Invalid range parameters");
    case "PGRST103":
      return new DatabaseConstraintException(message || "Constraint violation");
    case "PGRST202":
      return new DatabaseValidationException(message || "Validation failed");
    case "PGRST000":
      return new DatabaseConnectionException(
        message || "Database connection failed",
      );
    default:
      return new DatabaseException(message || "Database operation failed");
  }
}

// Helper function to handle database operations with proper error mapping
export async function handleDatabaseOperation<T>(
  operation: () => Promise<{ data: T; error: ISupabaseError | null }>,
): Promise<T> {
  try {
    const { data, error } = await operation();

    if (error) {
      throw mapSupabaseError(error);
    }

    return data;
  } catch (error) {
    if (error instanceof DatabaseException) {
      throw error;
    }

    // Handle unexpected errors
    throw new DatabaseException(
      error instanceof Error ? error.message : "Unknown database error",
    );
  }
}
