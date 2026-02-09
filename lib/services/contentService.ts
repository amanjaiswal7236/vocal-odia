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
  async getCategories() {
    try {
      const path = `${API_URL}/content/categories`;
      const url = path.startsWith('http') ? path : (typeof window !== 'undefined' ? window.location.origin : '') + (path.startsWith('/') ? path : '/' + path);
      const response = await retryRequest(() => fetchWithAuth(url), 2);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  },

  async getScenarios(params?: { categoryId?: string | number | null }) {
    try {
      const path = `${API_URL}/content/scenarios`;
      const url =
        params?.categoryId != null && params.categoryId !== ''
          ? `${path}?category_id=${encodeURIComponent(String(params.categoryId))}`
          : path;
      const fullUrl = url.startsWith('http') ? url : (typeof window !== 'undefined' ? window.location.origin : '') + (url.startsWith('/') ? url : '/' + url);
      const response = await retryRequest(() => fetchWithAuth(fullUrl), 2);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new AppError('Failed to load scenarios. Please try again.', 'FETCH_SCENARIOS_ERROR');
    }
  },

  async getCourses(userId?: number, params?: { categoryId?: string | number | null }) {
    try {
      let url = userId
        ? `${API_URL}/content/courses/user/${userId}`
        : `${API_URL}/content/courses`;
      if (!userId && params?.categoryId != null && params.categoryId !== '') {
        url += `?category_id=${encodeURIComponent(String(params.categoryId))}`;
      }
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

  // Admin category methods
  async createCategory(data: { name: string; description?: string; order_index?: number }) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to create category. Please try again.', 'CREATE_CATEGORY_ERROR');
    }
  },

  async updateCategory(id: number, data: { name?: string; description?: string; order_index?: number }) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to update category. Please try again.', 'UPDATE_CATEGORY_ERROR');
    }
  },

  async deleteCategory(id: number) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/categories/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to delete category. Please try again.', 'DELETE_CATEGORY_ERROR');
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

  async createSessionEarly(data: {
    scenarioId: string | null;
    scenarioTitle: string;
    isCourseLesson: boolean;
    courseId: string | null;
    startedAt: number;
  }) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/sessions/create-early`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      console.error('Failed to create early session:', error);
      return { success: false };
    }
  },

  async updateSession(sessionId: number, data: {
    tokensUsed: number;
    durationSeconds: number;
    messages?: Array<{ text: string; sender: 'user' | 'ai'; timestamp: number; audioUrl?: string | null; feedback?: 'up' | 'down' | null; feedbackReason?: string | null }>;
    sessionAudioUrl?: string | null;
  }) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return response.json();
    } catch (error) {
      console.error('Failed to update session:', error);
      return { success: false };
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
    messages?: Array<{ text: string; sender: 'user' | 'ai'; timestamp: number }>;
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
  },

  async getSessionMessages(sessionId: number) {
    try {
      const response = await retryRequest(
        () => fetchWithAuth(`${API_URL}/content/sessions/${sessionId}/messages`),
        2
      );
      return response.json();
    } catch (error) {
      throw new AppError('Failed to load session messages. Please try again.', 'FETCH_SESSION_MESSAGES_ERROR');
    }
  },

  async submitMessageFeedback(
    sessionId: number,
    messageId: string,
    feedback: 'up' | 'down',
    reason?: string
  ) {
    try {
      const url = `${API_URL}/content/sessions/${sessionId}/messages/${messageId}/feedback`;
      const fullUrl = url.startsWith('http') ? url : (typeof window !== 'undefined' ? window.location.origin : '') + (url.startsWith('/') ? url : '/' + url);
      const response = await fetchWithAuth(fullUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, reason: reason ?? '' }),
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to save feedback. Please try again.', 'SUBMIT_MESSAGE_FEEDBACK_ERROR');
    }
  },

  async completeLesson(lessonId: number) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/lessons/${lessonId}/complete`, {
        method: 'POST',
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to mark lesson as completed. Please try again.', 'COMPLETE_LESSON_ERROR');
    }
  },

  async unlockCourse(courseId: number) {
    try {
      const response = await fetchWithAuth(`${API_URL}/content/courses/${courseId}/unlock`, {
        method: 'POST',
      });
      return response.json();
    } catch (error) {
      throw new AppError('Failed to unlock course. Please try again.', 'UNLOCK_COURSE_ERROR');
    }
  },

  async getDocuments() {
    const response = await fetchWithAuth(`${API_URL}/content/documents`);
    return response.json();
  },

  async getDocument(id: string) {
    const response = await fetchWithAuth(`${API_URL}/content/documents/${id}`);
    return response.json();
  },

  async createDocument(data: { title?: string; paragraphs?: string[] }) {
    const response = await fetchWithAuth(`${API_URL}/content/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title ?? 'Untitled Document',
        paragraphs: data.paragraphs ?? [],
      }),
    });
    return response.json();
  },

  async updateDocument(id: string, data: { title?: string; paragraphs?: string[] }) {
    const response = await fetchWithAuth(`${API_URL}/content/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteDocument(id: string) {
    const response = await fetchWithAuth(`${API_URL}/content/documents/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },
};

