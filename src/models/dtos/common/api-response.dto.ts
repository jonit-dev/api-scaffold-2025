export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp?: Date;
}

export class ApiResponseDto<T> implements IApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: Date;

  constructor(success: boolean, message: string, data?: T, error?: string) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
    this.timestamp = new Date();
  }

  static success<T>(message: string, data?: T): ApiResponseDto<T> {
    return new ApiResponseDto(true, message, data);
  }

  static error(message: string, error?: string): ApiResponseDto<null> {
    return new ApiResponseDto(false, message, null, error);
  }
}
