'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import LiveSession from '@/components/LiveSession';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import { Scenario } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { contentService } from '@/lib/services/contentService';

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { scenarios, courses, setCourses, currentUser, refreshContent } = useAppContext();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [sessionStartTime] = useState<number>(Date.now());

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/signin');
      return;
    }

    const scenarioId = params.id as string;
    const courseIdFromQuery = searchParams.get('courseId');
    
    console.log('Session page - Looking for scenario:', scenarioId);
    console.log('Available scenarios:', scenarios.map(s => ({ id: s.id, title: s.title })));
    console.log('Course ID from query:', courseIdFromQuery);
    
    let foundScenario: Scenario | null = null;
    let courseId: string | null = courseIdFromQuery || null;
    
    // If there's a courseId query param, prioritize checking course lessons FIRST
    // This ensures course lessons are not mistaken for scenarios with the same ID
    if (courseIdFromQuery) {
      for (const course of courses) {
        if (course.id === courseIdFromQuery) {
          for (const module of course.modules) {
            for (const lesson of module.lessons) {
              if (lesson.id === scenarioId) {
                foundScenario = {
                  ...lesson,
                  icon: 'fa-book',
                  id: lesson.id,
                  description: lesson.objective,
                  isCourseLesson: true
                };
                courseId = course.id;
                break;
              }
            }
            if (foundScenario) break;
          }
          if (foundScenario) break;
        }
      }
    }
    
    // If not found in course lessons, check scenarios (only if no courseId was provided)
    if (!foundScenario) {
      const scenarioMatch = scenarios.find(s => s.id === scenarioId);
      if (scenarioMatch) {
        foundScenario = {
          ...scenarioMatch,
          image: scenarioMatch.image || undefined
        };
        console.log('Found scenario in scenarios list:', foundScenario.title, 'Image:', foundScenario.image);
      }
    }
    
    // If still not found and no courseId query, check all courses (fallback for direct lesson access)
    if (!foundScenario && !courseIdFromQuery) {
      for (const course of courses) {
        for (const module of course.modules) {
          for (const lesson of module.lessons) {
            if (lesson.id === scenarioId) {
              foundScenario = {
                ...lesson,
                icon: 'fa-book',
                id: lesson.id,
                description: lesson.objective,
                isCourseLesson: true
              };
              courseId = course.id;
              break;
            }
          }
          if (foundScenario) break;
        }
        if (foundScenario) break;
      }
    }

    if (foundScenario) {
      console.log('Setting scenario:', foundScenario.title, 'isCourseLesson:', foundScenario.isCourseLesson);
      setScenario(foundScenario);
      setActiveCourseId(courseId);
      setLoading(false);
    } else {
      console.log('Scenario not found, redirecting to dashboard');
      // If scenarios/courses haven't loaded yet, wait a bit
      if (scenarios.length === 0 && courses.length === 0) {
        // Wait for content to load
        const timer = setTimeout(() => {
          setLoading(false);
          router.push('/dashboard');
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Content loaded but scenario not found
        setLoading(false);
        router.push('/dashboard');
      }
    }
  }, [params.id, scenarios, courses, router, searchParams]);

  const handleEnd = async (estimatedTokens?: number, transcriptions?: any[]) => {
    const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    // Record session in database
    if (currentUser && scenario) {
      await contentService.recordSession({
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        isCourseLesson: scenario.isCourseLesson || false,
        courseId: activeCourseId || null,
        tokensUsed: estimatedTokens || 0,
        durationSeconds,
        startedAt: sessionStartTime,
        messages: transcriptions || []
      });
    }
    
    if (estimatedTokens && currentUser) {
      // Update quest progress
      const quests = await contentService.getQuests(parseInt(currentUser.id)).catch(() => []);
      const sessionQuest = quests.find((q: any) => q.type === 'session');
      if (sessionQuest) {
        await contentService.updateQuest(
          parseInt(sessionQuest.id.toString()),
          sessionQuest.current + 1,
          sessionQuest.current + 1 >= sessionQuest.target
        );
      }
    }

    if (scenario?.isCourseLesson && activeCourseId) {
      // Mark lesson as completed
      setCourses(prev => prev.map(c => {
        if (c.id === activeCourseId) {
          const updatedModules = c.modules.map(m => ({
            ...m,
            lessons: m.lessons.map(l => 
              l.id === scenario.id ? { ...l, completed: true } : l
            )
          }));
          return { ...c, modules: updatedModules };
        }
        return c;
      }));

      // Check if course is complete
      const course = courses.find(c => c.id === activeCourseId);
      if (course) {
        const updatedCourse = {
          ...course,
          modules: course.modules.map(m => ({
            ...m,
            lessons: m.lessons.map(l => 
              l.id === scenario.id ? { ...l, completed: true } : l
            )
          }))
        };
        
        const allCompleted = updatedCourse.modules.every(m => 
          m.lessons.every(l => l.completed)
        );
        
        if (allCompleted) {
          router.push(`/courses/${activeCourseId}/feedback`);
        } else {
          router.push('/courses');
        }
      } else {
        router.push('/courses');
      }
    } else {
      router.push('/dashboard');
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading session..." />;
  }

  if (!scenario) {
    return null;
  }

  return <LiveSession scenario={scenario} onEnd={handleEnd} />;
}

