'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SessionsList from '@/components/SessionsList';
import SessionDetails from '@/components/SessionDetails';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { UserSession } from '@/types';

export default function SessionsPage() {
  const router = useRouter();
  const { loading, currentUser } = useAppContext();
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);

  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) {
      router.push('/signin');
    }
  }, [loading, router]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!currentUser) {
    return null;
  }

  const handleBack = () => {
    if (selectedSession) {
      setSelectedSession(null);
    } else {
      router.push('/dashboard');
    }
  };

  const handleSelectSession = (session: UserSession) => {
    setSelectedSession(session);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {selectedSession ? (
        <SessionDetails session={selectedSession} onBack={handleBack} />
      ) : (
        <SessionsList
          userId={parseInt(currentUser.id)}
          onBack={handleBack}
          onSelectSession={handleSelectSession}
        />
      )}
    </div>
  );
}
