/**
 * Utility functions for converting between camelCase and snake_case
 * This is primarily used for Supabase database interactions
 */

/**
 * Converts a string from camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts a string from snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts object keys from camelCase to snake_case
 */
export function camelToSnakeKeys<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnakeKeys(item)) as T;
  }

  if (typeof obj === "object" && obj.constructor === Object) {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnake(key);
      // Convert values for SQLite compatibility
      let processedValue = value;
      if (typeof value === "string" || typeof value === "number") {
        processedValue = value;
      } else if (typeof value === "boolean") {
        // Convert booleans to integers for SQLite
        processedValue = value ? 1 : 0;
      } else if (value && typeof value === "object") {
        processedValue = camelToSnakeKeys(value);
      } else if (value === null || value === undefined) {
        processedValue = null;
      } else {
        // Convert other types (like enums) to strings
        processedValue = String(value);
      }
      result[snakeKey] = processedValue;
    }

    return result as T;
  }

  return obj as T;
}

/**
 * Converts object keys from snake_case to camelCase
 */
export function snakeToCamelKeys<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamelKeys(item)) as T;
  }

  if (typeof obj === "object" && obj.constructor === Object) {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);
      // Convert SQLite integers back to booleans for fields that should be boolean
      let processedValue = value;
      if (
        key.includes("verified") ||
        key.includes("enabled") ||
        key.includes("active")
      ) {
        if (value === 0 || value === 1) {
          processedValue = Boolean(value);
        } else {
          processedValue = snakeToCamelKeys(value);
        }
      } else {
        processedValue = snakeToCamelKeys(value);
      }
      result[camelKey] = processedValue;
    }

    return result as T;
  }

  return obj as T;
}
