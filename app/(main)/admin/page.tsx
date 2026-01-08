'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, scenarios, nuggets, courses, usageStats, usersUsage, setScenarios, setNuggets, setCourses, loading } = useAppContext();

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
      nuggets={nuggets}
      courses={courses}
      stats={usageStats}
      users={usersUsage}
      onUpdateScenarios={setScenarios}
      onUpdateNuggets={setNuggets}
      onUpdateCourses={setCourses}
      onExit={handleExit}
    />
  );
}

