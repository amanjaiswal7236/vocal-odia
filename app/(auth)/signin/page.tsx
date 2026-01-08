'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SignIn from '@/components/SignIn';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';

export default function SignInPage() {
  const router = useRouter();
  const { setCurrentUser, loadContent } = useAppContext();

  useEffect(() => {
    // Redirect if already authenticated
    if (authService.isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSuccess = async () => {
    const user = authService.getUser();
    if (user) {
      setCurrentUser(user);
      await loadContent(parseInt(user.id));
      router.push('/dashboard');
    }
  };

  const handleSwitchToSignUp = () => {
    router.push('/signup');
  };

  return <SignIn onSuccess={handleSuccess} onSwitchToSignUp={handleSwitchToSignUp} />;
}

