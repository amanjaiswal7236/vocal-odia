'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UserProfile from '@/components/UserProfile';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ProfilePage() {
  const router = useRouter();
  const { currentUser, loading } = useAppContext();

  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) {
      router.push('/signin');
    }
  }, [loading, router]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading profile..." />;
  }

  if (!currentUser) {
    return null;
  }

  const handleBack = () => {
    router.push('/dashboard');
  };

  return (
    <UserProfile
      user={{
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        tokens: currentUser.tokens,
        sessions: currentUser.sessions,
        lastActive: currentUser.lastActive,
        streak: currentUser.streak,
        mistakesFixed: currentUser.mistakesFixed
      }}
      onBack={handleBack}
    />
  );
}

