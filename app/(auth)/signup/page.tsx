'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SignUp from '@/components/SignUp';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';

export default function SignUpPage() {
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

  const handleSwitchToSignIn = () => {
    router.push('/signin');
  };

  return <SignUp onSuccess={handleSuccess} onSwitchToSignIn={handleSwitchToSignIn} />;
}

