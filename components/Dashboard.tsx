'use client';

import React, { useState, useEffect } from 'react';
import { Scenario, DailyNugget, Course, DailyQuest } from '@/types';
import { contentService } from '@/lib/services/contentService';
import { AI_AGENT } from '@/lib/constants';
import EmptyState from '@/components/EmptyState';
import LoadingSpinner from '@/components/LoadingSpinner';

interface DashboardProps {
  onStartScenario: (scenario: Scenario) => void;
  onOpenCourse: () => void;
  onStartShadowing: () => void;
  onViewSessions: () => void;
  onViewScenarios: () => void;
  scenarios: Scenario[];
  nuggets: DailyNugget[];
  course: Course;
  quests: DailyQuest[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onStartScenario, 
  onOpenCourse, 
  onStartShadowing,
  onViewSessions,
  onViewScenarios,
  scenarios, 
  nuggets, 
  course, 
  quests 
}) => {
  const [badges, setBadges] = useState<any[]>([]);

  const [badgesLoading, setBadgesLoading] = useState(true);

  useEffect(() => {
    contentService.getBadges()
      .then(data => {
      setBadges(data.map((b: any) => ({
        id: b.id.toString(),
        name: b.name,
        icon: b.icon,
        threshold: b.threshold
      })));
      })
      .catch(console.error)
      .finally(() => setBadgesLoading(false));
  }, []);

  const allLessons = course?.modules?.flatMap(m => m.lessons) || [];
  const nextLesson = allLessons.find(l => !l.completed) || allLessons[0];
  const completedCount = allLessons.filter(l => l.completed).length;
  const progressPercent = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-md">
            <h1 className="text-3xl font-extrabold mb-2">Namaskar! 🙏</h1>
            <p className="text-slate-200 text-lg">{AI_AGENT.NAME}, your linguistic coach, is ready. Choose your practice method.</p>
            <div className="flex flex-wrap gap-4 mt-8">
              <button onClick={onOpenCourse} className="bg-green-500 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-green-600 transition-all flex items-center gap-2">
                <i className="fas fa-book-open"></i> Guided Lesson
              </button>
              <button onClick={onStartShadowing} className="bg-white/10 backdrop-blur-sm border border-white/30 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-white/20 transition-all flex items-center gap-2">
                <i className="fas fa-volume-up"></i> Pronunciation
              </button>
              <button onClick={onViewScenarios} className="bg-white/10 backdrop-blur-sm border border-white/30 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-white/20 transition-all flex items-center gap-2">
                <i className="fas fa-comments"></i> Scenarios
              </button>
              <button onClick={onViewSessions} className="bg-white/10 backdrop-blur-sm border border-white/30 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-white/20 transition-all flex items-center gap-2">
                <i className="fas fa-history"></i> Sessions
              </button>
            </div>
          </div>

          {/* <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 min-w-[280px]">
            <p className="text-xs font-black uppercase tracking-widest text-blue-200 mb-3">Level: {course.title}</p>
            <h3 className="font-bold text-xl mb-1">{nextLesson?.title || 'No lessons available'}</h3>
            {course && (
              <>
                <div className="w-full bg-white/20 h-1.5 rounded-full mb-2 mt-4">
                  <div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <p className="text-[10px] font-bold text-right">{progressPercent}% Progress</p>
              </>
            )}
          </div> */}
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12 transition-transform duration-700 group-hover:rotate-45">
           <i className="fas fa-microphone-lines text-9xl"></i>
        </div>
      </section>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* Quests Section - Hidden */}
          {/* <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-900">
              <i className="fas fa-star text-yellow-500"></i> Daily Quests
            </h2>
            <div className="space-y-6">
              {quests.length === 0 ? (
                <EmptyState
                  icon="fa-tasks"
                  title="No quests available"
                  description="Check back tomorrow for new daily quests!"
                />
              ) : (
                quests.map(q => (
                <div key={q.id} className="group">
                  <div className="flex justify-between items-center mb-2">
                    <p className={`text-sm font-bold ${q.completed ? 'text-green-600' : 'text-gray-700'}`}>
                      {q.label} {q.completed && <i className="fas fa-check-circle ml-1"></i>}
                    </p>
                    <span className="text-xs font-black text-gray-400">
                      {q.current} / {q.target}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-700 ${q.completed ? 'bg-green-500' : 'bg-green-600'}`} 
                      style={{ width: `${(q.current / q.target) * 100}%` }}
                    />
                  </div>
                </div>
                ))
              )}
            </div>
          </div> */}

          {/* Scenarios List */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <i className="fas fa-comments text-green-600"></i> Live Lab Scenarios
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {scenarios.length === 0 ? (
                <div className="col-span-2">
                  <EmptyState
                    icon="fa-comments"
                    title="No scenarios available"
                    description="Scenarios will appear here when available"
                  />
                </div>
              ) : (
                scenarios.map((s) => (
                  <button 
                    key={s.id} 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onStartScenario(s);
                    }} 
                    className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 text-left transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    aria-label={`Start scenario: ${s.title}`}
                    type="button"
                  >
                  <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <i className={`fas ${s.icon} text-xl`} aria-hidden="true"></i>
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors">{s.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.description}</p>
                </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Daily Nugget Section - Hidden */}
          {/* <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold mb-4 flex items-center gap-2"><i className="fas fa-lightbulb text-yellow-500"></i> Daily Nugget</h2>
            {nuggets.length === 0 ? (
              <EmptyState
                icon="fa-lightbulb"
                title="No nuggets available"
                description="Daily nuggets will appear here"
              />
            ) : (
              nuggets.map((n, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="font-bold text-green-600">{n.word}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{n.definition}</p>
                </div>
              ))
            )}
          </div> */}

          {/* Milestones Section - Hidden */}
          {/* <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-indigo-900"><i className="fas fa-trophy text-indigo-600"></i> Milestones</h2>
            {badgesLoading ? (
              <LoadingSpinner size="sm" />
            ) : badges.length === 0 ? (
              <EmptyState
                icon="fa-trophy"
                title="No badges yet"
                description="Complete quests to earn badges!"
              />
            ) : (
              badges.slice(0, 3).map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2 bg-white/50 rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-sm font-medium text-indigo-900">{b.name}</span>
                </div>
              </div>
              ))
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
