'use client';

import { SignUpData, SignInData, AuthResponse } from '@/types';
import { handleApiError, retryRequest, AppError } from '@/lib/utils/errorHandler';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const fetchWithRetry = async (url: string, options: RequestInit, retries = 2): Promise<Response> => {
  return retryRequest(
    async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        await handleApiError(response);
      }
      return response;
    },
    retries,
    1000
  );
};

export const authService = {
  async signUp(data: SignUpData): Promise<AuthResponse> {
    try {
      const response = await fetchWithRetry(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return result;
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(
        'Failed to connect to server. Please check your internet connection.',
        'NETWORK_ERROR',
        0,
        true
      );
    }
  },

  async signIn(data: SignInData): Promise<AuthResponse> {
    try {
      const response = await fetchWithRetry(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return result;
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(
        'Failed to connect to server. Please check your internet connection.',
        'NETWORK_ERROR',
        0,
        true
      );
    }
  },

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  },

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', token);
  },

  getUser(): any | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser(user: any): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user', JSON.stringify(user));
  },

  clearAuth(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

