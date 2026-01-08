'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CourseMap from '@/components/CourseMap';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import { Lesson } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function CoursesPage() {
  const router = useRouter();
  const { courses, loading, setCourses } = useAppContext();

  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) {
      router.push('/signin');
    }
  }, [loading, router]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading courses..." />;
  }

  const handleSelectLesson = (courseId: string, lesson: Lesson) => {
    // Store course ID for feedback after completion
    router.push(`/session/${lesson.id}?courseId=${courseId}`);
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  return (
    <CourseMap
      courses={courses}
      onSelectLesson={handleSelectLesson}
      onBack={handleBack}
    />
  );
}

