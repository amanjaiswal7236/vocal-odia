'use client';

import React, { useState, useEffect } from 'react';
import { UserUsage } from '@/types';
import { contentService } from '@/lib/services/contentService';

interface UserProfileProps {
  user: UserUsage;
  onBack: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onBack }) => {
  const [badges, setBadges] = useState<any[]>([]);
  const wordsLearned = Math.floor(user.tokens / 150);

  useEffect(() => {
    contentService.getBadges().then(data => {
      setBadges(data.map((b: any) => ({
        id: b.id.toString(),
        name: b.name,
        icon: b.icon,
        threshold: b.threshold
      })));
    }).catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom duration-500 pb-12">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <i className="fas fa-arrow-left text-gray-600"></i>
        </button>
        <h1 className="text-2xl font-black text-gray-900">Coach Profile</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
            <div className="relative inline-block mb-4">
              <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full border-4 border-indigo-50 shadow-md mx-auto" />
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 border-4 border-white rounded-full flex items-center justify-center text-white text-[10px]">
                <i className="fas fa-check"></i>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
            <div className="flex justify-center gap-2 mt-4">
              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Intermediate
              </span>
              <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {user.streak} Day Streak
              </span>
            </div>
          </div>

          <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden">
            <h3 className="font-bold text-sm uppercase tracking-widest text-indigo-300 mb-4">Next Badge</h3>
            <div className="text-center py-4">
               <span className="text-6xl grayscale opacity-50">🥇</span>
               <p className="mt-4 font-bold">Puri Gold</p>
               <p className="text-[10px] text-indigo-300">Need 7 more sessions</p>
            </div>
            <div className="absolute -bottom-8 -right-8 opacity-10">
               <i className="fas fa-trophy text-9xl"></i>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
              <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">Total Sessions</p>
              <p className="text-3xl font-black text-gray-900">{user.sessions}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
              <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">Mistakes Refined</p>
              <p className="text-3xl font-black text-gray-900">{user.mistakesFixed?.length || 12}</p>
            </div>
          </div>

          {/* Mistake Bank */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center gap-2">
              <i className="fas fa-shield-virus text-indigo-400"></i> Odinglish Mistake Bank
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">Common Pitfall</p>
                <div className="flex justify-between items-center">
                   <p className="text-sm font-medium text-gray-700 italic">"Myself Amit..."</p>
                   <i className="fas fa-arrow-right text-gray-300 mx-4"></i>
                   <p className="text-sm font-bold text-green-600">"I am Amit"</p>
                </div>
              </div>
              <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-2">Refining Tense</p>
                <div className="flex justify-between items-center">
                   <p className="text-sm font-medium text-gray-700 italic">"He didn't told me"</p>
                   <i className="fas fa-arrow-right text-gray-300 mx-4"></i>
                   <p className="text-sm font-bold text-green-600">"He didn't tell me"</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <i className="fas fa-graduation-cap"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold">Timeline Module Completion</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">2 Days Ago</p>
                  </div>
                </div>
                <span className="text-xs font-black text-indigo-600">Lvl 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
