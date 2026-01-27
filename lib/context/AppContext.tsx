'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthUser, Scenario, DailyNugget, Course, DailyQuest, UsageStats, UserUsage, Category } from '@/types';
import { authService } from '@/lib/services/authService';
import { contentService } from '@/lib/services/contentService';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';

interface AppContextType {
  currentUser: AuthUser | null;
  scenarios: Scenario[];
  categories: Category[];
  nuggets: DailyNugget[];
  courses: Course[];
  quests: DailyQuest[];
  usageStats: UsageStats;
  usersUsage: UserUsage[];
  loading: boolean;
  error: string | null;
  loadContent: (userId?: number) => Promise<void>;
  setCurrentUser: (user: AuthUser | null) => void;
  setScenarios: (scenarios: Scenario[] | ((prev: Scenario[]) => Scenario[])) => void;
  setCategories: (categories: Category[] | ((prev: Category[]) => Category[])) => void;
  setNuggets: (nuggets: DailyNugget[] | ((prev: DailyNugget[]) => DailyNugget[])) => void;
  setCourses: (courses: Course[] | ((prev: Course[]) => Course[])) => void;
  setQuests: (quests: DailyQuest[] | ((prev: DailyQuest[]) => DailyQuest[])) => void;
  setUsageStats: (stats: UsageStats | ((prev: UsageStats) => UsageStats)) => void;
  refreshContent: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const router = useRouter();
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nuggets, setNuggets] = useState<DailyNugget[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    tokensUsed: 0,
    sessionsCount: 0,
    lastActive: Date.now(),
    errorCount: 0,
    dailyTokens: [],
    userTokens: []
  });
  const [usersUsage, setUsersUsage] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = async (userId?: number) => {
    try {
      setLoading(true);
      setError(null);
      const [categoriesData, scenariosData, nuggetsData, coursesData, questsData, statsData] = await Promise.allSettled([
        contentService.getCategories(),
        contentService.getScenarios(),
        contentService.getNuggets(),
        userId ? contentService.getCourses(userId) : contentService.getCourses(),
        userId ? contentService.getQuests(userId) : Promise.resolve([]),
        // Don't load user stats for admin - they use admin stats instead
        (userId && currentUser?.role !== 'admin') ? contentService.getStats(userId) : Promise.resolve(null)
      ]);

      if (categoriesData.status === 'fulfilled' && Array.isArray(categoriesData.value)) {
        setCategories((categoriesData.value as any[]).map((c: any) => ({
          id: String(c.id),
          name: c.name,
          description: c.description,
          orderIndex: c.order_index ?? c.orderIndex,
        })));
      } else if (categoriesData.status === 'fulfilled' && !Array.isArray(categoriesData.value)) {
        setCategories([]);
      }

      if (scenariosData.status === 'fulfilled') {
        const raw = scenariosData.value;
        const list = Array.isArray(raw) ? raw : [];
        setScenarios(list.map((s: any) => ({ 
          ...s, 
          id: String(s.id),
          image: s.image || undefined,
          temperature: s.temperature ?? undefined,
          topP: s.top_p ?? undefined,
          topK: s.top_k ?? undefined,
          maxOutputTokens: s.max_output_tokens ?? undefined,
          categoryId: s.category_id != null ? String(s.category_id) : null,
          category: s.category ? { id: String(s.category.id || s.category_id), name: s.category.name, description: s.category.description, orderIndex: s.category.orderIndex ?? s.category.order_index } : (s.category_id != null && s.category_name ? { id: String(s.category_id), name: s.category_name, description: s.category_description, orderIndex: s.category_order_index } : null),
        })));
      } else {
        if (scenariosData.status === 'rejected') {
          console.error('Failed to load scenarios:', scenariosData.reason);
          showToast('Failed to load some scenarios', 'warning');
        }
        setScenarios([]);
      }

      if (nuggetsData.status === 'fulfilled') {
        setNuggets(nuggetsData.value);
      }

      if (coursesData.status === 'fulfilled') {
        const transformedCourses = (coursesData.value as any[]).map((c: any) => ({
          id: c.id.toString(),
          title: c.title,
          level: c.level,
          description: c.description,
          prerequisiteId: c.prerequisite_id ? c.prerequisite_id.toString() : undefined,
          isUnlocked: c.is_unlocked,
          categoryId: c.category_id != null ? String(c.category_id) : null,
          category: (c.category_name || c.category_id) ? { id: String(c.category_id || ''), name: c.category_name || '', description: c.category_description, orderIndex: c.category_order_index } : null,
          modules: (c.modules || []).map((m: any) => ({
            id: m.id.toString(),
            title: m.title,
            lessons: (m.lessons || []).map((l: any) => ({
              id: l.id.toString(),
              title: l.title,
              objective: l.objective,
              prompt: l.prompt,
              completed: l.completed || false
            }))
          }))
        }));
        setCourses(transformedCourses);
      } else {
        console.error('Failed to load courses:', coursesData.reason);
        showToast('Failed to load courses', 'error');
      }

      if (questsData.status === 'fulfilled') {
        const transformedQuests = questsData.value.map((q: any) => ({
          id: q.id.toString(),
          label: q.label,
          target: q.target,
          current: q.current,
          completed: q.completed,
          type: q.type
        }));
        setQuests(transformedQuests);
      }

      if (statsData.status === 'fulfilled' && statsData.value) {
        // For admin users, preserve admin stats (dailyTokens, userTokens)
        // For regular users, set the user stats
        setUsageStats(prev => {
          // If we already have admin stats (dailyTokens/userTokens), preserve them
          const hasAdminData = Array.isArray(prev.dailyTokens) && prev.dailyTokens.length > 0 || 
                               Array.isArray(prev.userTokens) && prev.userTokens.length > 0;
          if (hasAdminData) {
            return {
              ...statsData.value,
              dailyTokens: prev.dailyTokens || [],
              userTokens: prev.userTokens || []
            };
          }
          return statsData.value;
        });
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshContent = async () => {
    if (currentUser) {
      await loadContent(parseInt(currentUser.id));
    }
  };

  // Check authentication on mount
  useEffect(() => {
    const user = authService.getUser();
    if (user && authService.isAuthenticated()) {
      setCurrentUser(user);
      
      // Load admin data if user is admin
      if (user.role === 'admin') {
        Promise.allSettled([
          contentService.getAdminStats(),
          contentService.getAllUsers()
        ]).then(([statsResult, usersResult]) => {
          if (statsResult.status === 'fulfilled') {
            const stats = statsResult.value;
            // Ensure arrays are always present
            setUsageStats({
              ...stats,
              dailyTokens: stats.dailyTokens || [],
              userTokens: stats.userTokens || []
            });
          }
          if (usersResult.status === 'fulfilled') {
            setUsersUsage(usersResult.value);
          }
        });
        // Load content for admin (scenarios, courses, etc.) but don't load user stats
        loadContent(parseInt(user.id));
      } else {
        setUsersUsage([{
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          tokens: user.tokens,
          sessions: user.sessions,
          lastActive: user.lastActive,
          streak: user.streak,
          mistakesFixed: user.mistakesFixed || []
        }]);
        loadContent(parseInt(user.id));
      }
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        scenarios,
        categories,
        nuggets,
        courses,
        quests,
        usageStats,
        usersUsage,
        loading,
        error,
        loadContent,
        setCurrentUser,
        setScenarios,
        setCategories,
        setNuggets,
        setCourses,
        setQuests,
        setUsageStats,
        refreshContent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

