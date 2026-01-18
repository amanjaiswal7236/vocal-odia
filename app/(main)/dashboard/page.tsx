'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Scenario } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, scenarios, nuggets, courses, quests, loading, error } = useAppContext();

  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) {
      router.push('/signin');
    }
  }, [loading, router]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading your learning journey..." />;
  }

  if (!currentUser) {
    return null;
  }

  const handleStartScenario = (scenario: Scenario) => {
    // Ensure we navigate to session page, not courses
    if (scenario && scenario.id) {
      console.log('Starting scenario:', scenario.title, 'ID:', scenario.id);
      router.push(`/session/${scenario.id}`);
    } else {
      console.error('Invalid scenario:', scenario);
    }
  };

  const handleOpenCourse = () => {
    router.push('/courses');
  };

  const handleStartShadowing = () => {
    router.push('/shadowing');
  };

  const handleViewScenarios = () => {
    router.push('/scenarios');
  };

  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              if (currentUser) {
                window.location.reload();
              }
            }}
            className="text-red-600 hover:text-red-800"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      <Dashboard
        onStartScenario={handleStartScenario}
        onOpenCourse={handleOpenCourse}
        onStartShadowing={handleStartShadowing}
        onViewScenarios={handleViewScenarios}
        scenarios={scenarios}
        nuggets={nuggets}
        course={courses[0] || { id: '', title: '', level: 'BEGINNER' as any, description: '', modules: [] }}
        quests={quests}
      />
    </>
  );
}

