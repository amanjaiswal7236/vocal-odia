'use client';

import React, { useState } from 'react';

interface AdminLoginProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onCancel }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate a secure delay
    setTimeout(() => {
      if (passcode === 'admin123') { // Updated default passcode
        onSuccess();
      } else {
        setError(true);
        setPasscode('');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
              <i className="fas fa-user-shield text-2xl"></i>
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-center text-gray-900 mb-2">Staff Access</h2>
          <p className="text-gray-500 text-center text-sm mb-8">Please enter the administrator passcode to proceed.</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Passcode</label>
              <input
                type="password"
                autoFocus
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(false);
                }}
                className={`w-full px-5 py-4 bg-gray-50 border ${error ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100'} rounded-2xl outline-none transition-all text-center text-xl tracking-[0.5em] font-mono`}
                placeholder="••••••••"
              />
              {error && (
                <p className="text-red-500 text-xs font-bold mt-3 text-center animate-bounce">
                  Incorrect passcode. Access denied.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !passcode}
              className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl active:scale-95"
            >
              {loading ? (
                <i className="fas fa-circle-notch animate-spin"></i>
              ) : (
                'Authenticate'
              )}
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-gray-400 font-bold py-2 hover:text-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
          </form>
        </div>
        
        <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
            Restricted System &bull; Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
