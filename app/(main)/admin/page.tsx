'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, scenarios, categories, nuggets, courses, usageStats, usersUsage, setScenarios, setCategories, setNuggets, setCourses, refreshContent, loading } = useAppContext();

  useEffect(() => {
    if (!loading) {
      if (!authService.isAuthenticated()) {
        router.push('/signin');
        return;
      }
      if (currentUser?.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [loading, currentUser, router]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading admin dashboard..." />;
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  const handleExit = () => {
    router.push('/dashboard');
  };

  return (
    <AdminDashboard
      scenarios={scenarios}
      categories={categories}
      nuggets={nuggets}
      courses={courses}
      stats={usageStats}
      users={usersUsage}
      onUpdateScenarios={setScenarios}
      onUpdateCategories={setCategories}
      onUpdateNuggets={setNuggets}
      onUpdateCourses={setCourses}
      onRefreshContent={refreshContent}
      onExit={handleExit}
    />
  );
}

