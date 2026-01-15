'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { authService } from '@/lib/services/authService';
import { useToast } from '@/components/Toast';
import { useOffline } from '@/lib/hooks/useOffline';
import { useEffect } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useAppContext();
  const { showToast } = useToast();
  const isOffline = useOffline();

  // Don't show navigation on auth pages
  const isAuthPage = pathname === '/signin' || pathname === '/signup';
  
  useEffect(() => {
    if (isOffline) {
      showToast('You are offline. Some features may not work.', 'warning', 5000);
    }
  }, [isOffline, showToast]);

  if (isAuthPage || !currentUser) {
    return null;
  }

  const handleSignOut = () => {
    authService.clearAuth();
    showToast('Signed out successfully', 'info');
    router.push('/signin');
  };

  const isAdmin = currentUser.role === 'admin';
  const isAdminPage = pathname === '/admin';

  return (
    <>
      {isOffline && (
        <div className="bg-yellow-500 text-white text-center py-2 px-4 text-sm font-bold">
          <i className="fas fa-wifi mr-2"></i>You are currently offline
        </div>
      )}
      <nav className="sticky top-0 z-50 glass-morphism border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => router.push('/dashboard')}
          >
            <div className="bg-slate-800 p-1.5 rounded-lg">
              <i className="fas fa-graduation-cap text-white"></i>
            </div>
            <span className="font-extrabold text-xl tracking-tight">
              Vocal<span className="text-green-600">Odia</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            {isAdmin && (
              <button
                onClick={() => router.push(isAdminPage ? '/dashboard' : '/admin')}
                className={`text-sm font-bold px-4 py-2 rounded-full border transition-all ${
                  isAdminPage
                    ? 'bg-red-500 text-white shadow-lg border-red-500'
                    : 'text-gray-500 border-transparent hover:bg-gray-100'
                }`}
              >
                <i className="fas fa-user-shield mr-2"></i>Admin
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm font-bold px-4 py-2 rounded-full border border-transparent hover:bg-gray-100 text-gray-500 transition-all"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>Sign Out
            </button>
            <div
              className={`w-9 h-9 rounded-full border-2 shadow-sm overflow-hidden cursor-pointer transition-all ${
                pathname === '/profile' ? 'border-green-600 scale-110' : 'border-white'
              }`}
              onClick={() => router.push('/profile')}
            >
              <img src={currentUser.avatar} alt="Profile" />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

