'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthUser, Scenario, DailyNugget, Course, DailyQuest, UsageStats, UserUsage } from '@/types';
import { authService } from '@/lib/services/authService';
import { contentService } from '@/lib/services/contentService';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';

interface AppContextType {
  currentUser: AuthUser | null;
  scenarios: Scenario[];
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
      const [scenariosData, nuggetsData, coursesData, questsData, statsData] = await Promise.allSettled([
        contentService.getScenarios(),
        contentService.getNuggets(),
        userId ? contentService.getCourses(userId) : contentService.getCourses(),
        userId ? contentService.getQuests(userId) : Promise.resolve([]),
        // Don't load user stats for admin - they use admin stats instead
        (userId && currentUser?.role !== 'admin') ? contentService.getStats(userId) : Promise.resolve(null)
      ]);

      if (scenariosData.status === 'fulfilled') {
        setScenarios(scenariosData.value.map((s: any) => ({ 
          ...s, 
          id: s.id.toString(),
          image: s.image || undefined
        })));
      } else {
        console.error('Failed to load scenarios:', scenariosData.reason);
        showToast('Failed to load some scenarios', 'warning');
      }

      if (nuggetsData.status === 'fulfilled') {
        setNuggets(nuggetsData.value);
      }

      if (coursesData.status === 'fulfilled') {
        const transformedCourses = coursesData.value.map((c: any) => ({
          id: c.id.toString(),
          title: c.title,
          level: c.level,
          description: c.description,
          prerequisiteId: c.prerequisite_id ? c.prerequisite_id.toString() : undefined,
          isUnlocked: c.is_unlocked,
          modules: c.modules.map((m: any) => ({
            id: m.id.toString(),
            title: m.title,
            lessons: m.lessons.map((l: any) => ({
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

