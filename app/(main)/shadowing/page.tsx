'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ShadowingSession from '@/components/ShadowingSession';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { contentService } from '@/lib/services/contentService';

export default function ShadowingPage() {
  const router = useRouter();
  const { loading, currentUser } = useAppContext();

  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) {
      router.push('/signin');
    }
  }, [loading, router]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  const handleBack = () => {
    router.push('/dashboard');
  };

  const handleComplete = async () => {
    // Update quest progress
    if (currentUser) {
      try {
        const quests = await contentService.getQuests(parseInt(currentUser.id));
        const shadowQuest = quests.find((q: any) => q.type === 'shadow');
        if (shadowQuest) {
          await contentService.updateQuest(
            parseInt(shadowQuest.id.toString()),
            shadowQuest.current + 1,
            shadowQuest.current + 1 >= shadowQuest.target
          );
        }
      } catch (error) {
        console.error('Failed to update quest:', error);
      }
    }
    router.push('/dashboard');
  };

  return (
    <ShadowingSession
      tasks={[]}
      onBack={handleBack}
      onComplete={handleComplete}
    />
  );
}

