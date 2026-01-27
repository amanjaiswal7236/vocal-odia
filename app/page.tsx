'use client';

import { useEffect } from 'react';
import { authService } from '@/lib/services/authService';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function HomePage() {
  useEffect(() => {
    const target = authService.isAuthenticated() ? '/dashboard' : '/signin';
    // Hard redirect so navigation completes reliably behind nginx/proxies
    window.location.replace(target);
  }, []);

  return <LoadingSpinner fullScreen text="Redirecting..." />;
}
