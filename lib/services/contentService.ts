'use client';

import { handleApiError, retryRequest, AppError } from '@/lib/utils/errorHandler';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const authHeaders = getAuthHeaders();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  return response;
};

export const contentService = {
  async getScenarios() {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/scenarios`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load scenarios. Please try again.', 'FETCH_SCENARIOS_ERROR');
    }
  },

  async getCourses(userId?: number) {
    try {
      const url = userId 
        ? `${API_URL}/content/courses/user/${userId}`
        : `${API_URL}/content/courses`;
      const response = await retryRequest(
        () => fetchWithAuth(url),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load courses. Please try again.', 'FETCH_COURSES_ERROR');
    }
  },

  async getNuggets() {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/nuggets`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load daily nuggets. Please try again.', 'FETCH_NUGGETS_ERROR');
    }
  },

  async getShadowingTasks() {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/shadowing-tasks`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load shadowing tasks. Please try again.', 'FETCH_SHADOWING_ERROR');
    }
  },

  async getQuests(userId: number) {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/quests/user/${userId}`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load quests. Please try again.', 'FETCH_QUESTS_ERROR');
    }
  },

  async getBadges() {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/badges`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load badges. Please try again.', 'FETCH_BADGES_ERROR');
    }
  },

  async getStats(userId: number) {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/stats/user/${userId}`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load statistics. Please try again.', 'FETCH_STATS_ERROR');
    }
  },

  async updateQuest(questId: number, current: number, completed: boolean) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/quests/${questId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ current, completed })
      });
      return response.json();
    } catch (error) {
      // Silently fail quest updates to not interrupt user experience
      console.error('Failed to update quest:', error);
      return { success: false };
    }
  },

  // Admin methods
  async createScenario(data: any) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/scenarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to create scenario. Please try again.', 'CREATE_SCENARIO_ERROR');
    }
  },

  async updateScenario(id: number, data: any) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/scenarios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to update scenario. Please try again.', 'UPDATE_SCENARIO_ERROR');
    }
  },

  async deleteScenario(id: number) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/scenarios/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to delete scenario. Please try again.', 'DELETE_SCENARIO_ERROR');
    }
  },

  async createCourse(data: any) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to create course. Please try again.', 'CREATE_COURSE_ERROR');
    }
  },

  async updateCourse(id: number, data: any) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/courses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to update course. Please try again.', 'UPDATE_COURSE_ERROR');
    }
  },

  async deleteCourse(id: number) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/courses/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to delete course. Please try again.', 'DELETE_COURSE_ERROR');
    }
  },

  async createNugget(data: any) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/nuggets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to create nugget. Please try again.', 'CREATE_NUGGET_ERROR');
    }
  },

  async deleteNugget(id: number) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/nuggets/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to delete nugget. Please try again.', 'DELETE_NUGGET_ERROR');
    }
  },

  // Admin methods for stats and users
  async getAdminStats() {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/stats/admin`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load admin statistics. Please try again.', 'FETCH_ADMIN_STATS_ERROR');
    }
  },

  async getAllUsers() {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/users`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load users. Please try again.', 'FETCH_USERS_ERROR');
    }
  },

  async getUserSessions(userId: number) {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/users/${userId}/sessions`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load user sessions. Please try again.', 'FETCH_USER_SESSIONS_ERROR');
    }
  },

  async recordSession(data: {
    scenarioId: string | null;
    scenarioTitle: string;
    isCourseLesson: boolean;
    courseId: string | null;
    tokensUsed: number;
    durationSeconds: number;
    startedAt: number;
  }) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      // Silently fail session recording to not interrupt user experience
      console.error('Failed to record session:', error);
      return { success: false };
    }
  }
};

