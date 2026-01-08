'use client';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public retryable?: boolean
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = 'An error occurred';
  let errorCode: string | undefined;
  
  try {
    const data = await response.json();
    errorMessage = data.error || data.message || errorMessage;
    errorCode = data.code;
  } catch {
    // If response is not JSON, use status text
    errorMessage = response.statusText || errorMessage;
  }

  const error = new AppError(
    errorMessage,
    errorCode,
    response.status,
    response.status >= 500 || response.status === 429
  );

  throw error;
};

export const retryRequest = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError!;
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof AppError) {
    return error.statusCode === 0 || error.code === 'NETWORK_ERROR';
  }
  if (error instanceof Error) {
    return error.message.includes('fetch') || error.message.includes('network');
  }
  return false;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

