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

  const handleEnd = async (estimatedTokens?: number, transcriptions?: any[], sessionAudioUrl?: string | null, sessionId?: number | null) => {
    const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    // Show loading state (handled by LiveSession component)
    
    // Update session with final data (session should already exist from early creation)
    if (currentUser && scenario) {
      try {
        // Use the sessionId directly if provided, otherwise try to find it
        if (sessionId) {
          // Direct update using the known sessionId
          const updateResult = await contentService.updateSession(sessionId, {
            tokensUsed: estimatedTokens || 0,
            durationSeconds,
            messages: transcriptions || [],
            sessionAudioUrl: sessionAudioUrl || null
          });
          
          if (updateResult.success) {
            console.log('Session updated successfully with sessionId:', sessionId, 'audio URL:', sessionAudioUrl);
          } else {
            console.error('Session update returned unsuccessful result:', updateResult);
          }
        } else {
          // Fallback: find the session if sessionId not provided
          const token = localStorage.getItem('token');
          if (token) {
            const sessionsResponse = await fetch(`/api/content/users/${currentUser.id}/sessions`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (sessionsResponse.ok) {
              const sessions = await sessionsResponse.json();
              const latestSession = sessions.find((s: any) => 
                s.scenarioId === scenario.id && 
                s.startedAt >= sessionStartTime - 5000 && // Within 5 seconds of start
                !s.endedAt // Only find active sessions
              );
              
              if (latestSession) {
                const updateResult = await contentService.updateSession(parseInt(latestSession.id), {
                  tokensUsed: estimatedTokens || 0,
                  durationSeconds,
                  messages: transcriptions || [],
                  sessionAudioUrl: sessionAudioUrl || null
                });
                
                if (updateResult.success) {
                  console.log('Session updated (found by search) with audio URL:', sessionAudioUrl);
                } else {
                  console.error('Session update returned unsuccessful result:', updateResult);
                }
              } else {
                // Fallback: create session if not found
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
            }
          }
        }
      } catch (err) {
        console.error('Error updating session:', err);
      }
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
      try {
        // Mark lesson as completed in database
        await contentService.completeLesson(parseInt(scenario.id));
        
        // Update local state
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
      } catch (err) {
        console.error('Error completing lesson:', err);
        // Still navigate even if lesson completion fails
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

  return <LiveSession scenario={scenario} courseId={activeCourseId} onEnd={handleEnd} />;
}

