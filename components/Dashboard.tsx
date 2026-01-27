'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Scenario, DailyNugget, Course, DailyQuest, Category } from '@/types';
import { contentService } from '@/lib/services/contentService';
import { AI_AGENT } from '@/lib/constants';
import EmptyState from '@/components/EmptyState';
import LoadingSpinner from '@/components/LoadingSpinner';

const UNCATEGORIZED_KEY = '__uncategorized__';
const SCENARIOS_PER_CATEGORY_PREVIEW = 3;

interface DashboardProps {
  onStartScenario: (scenario: Scenario) => void;
  onOpenCourse: () => void;
  onStartShadowing: () => void;
  onViewScenarios: (categoryId?: string) => void;
  scenarios: Scenario[];
  categories: Category[];
  nuggets: DailyNugget[];
  course: Course;
  quests: DailyQuest[];
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onStartScenario, 
  onOpenCourse, 
  onStartShadowing,
  onViewScenarios,
  scenarios, 
  categories,
  nuggets, 
  course, 
  quests,
  onRefresh,
  isRefreshing = false,
}) => {
  const [badges, setBadges] = useState<any[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const scenariosByCategory = useMemo(() => {
    const map = new Map<string, Scenario[]>();
    for (const s of scenarios) {
      const key = s.categoryId ?? UNCATEGORIZED_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [scenarios]);

  const orderedCategoryIds = useMemo(() => {
    const uncategorized = scenariosByCategory.has(UNCATEGORIZED_KEY);
    const ids = categories
      .filter((c) => scenariosByCategory.has(c.id))
      .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999))
      .map((c) => c.id);
    if (uncategorized) ids.push(UNCATEGORIZED_KEY);
    return ids;
  }, [categories, scenariosByCategory]);

  const visibleCategoryIds = categoryFilter === null || categoryFilter === ''
    ? orderedCategoryIds
    : orderedCategoryIds.filter((id) => id === categoryFilter);

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
      <section className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-lg">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">Namaskar! 🙏</h1>
            <p className="text-emerald-100/90 text-lg md:text-xl leading-relaxed">
              {AI_AGENT.NAME}, your coach, is ready. Pick a subject and start practicing.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button onClick={onOpenCourse} className="bg-white text-emerald-800 font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-emerald-50 transition-all flex items-center gap-2">
                <i className="fas fa-book-open"></i> Guided Lessons
              </button>
              <button onClick={() => onViewScenarios()} className="bg-white/15 backdrop-blur border border-white/30 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/25 transition-all flex items-center gap-2">
                <i className="fas fa-comments"></i> All Scenarios
              </button>
            </div>
          </div>
          <div className="hidden md:block absolute top-8 right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        </div>
      </section>

      <div className="space-y-8">
        <div className="space-y-8">
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

          {/* Scenarios by Category */}
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <i className="fas fa-flask"></i>
                </span>
                Live Lab Scenarios
              </h2>
              <div className="flex items-center gap-3">
                {categories.length > 0 && (
                  <select
                    value={categoryFilter ?? ''}
                    onChange={(e) => setCategoryFilter(e.target.value === '' ? null : e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition-shadow"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    {scenariosByCategory.has(UNCATEGORIZED_KEY) && (
                      <option value={UNCATEGORIZED_KEY}>Uncategorized</option>
                    )}
                  </select>
                )}
                {onRefresh && (
                  <button
                    type="button"
                    onClick={() => onRefresh()}
                    disabled={isRefreshing}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
                    title="Refresh"
                  >
                    <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i>
                    Refresh
                  </button>
                )}
              </div>
            </div>

            {scenarios.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm">
                <EmptyState
                  icon="fa-flask"
                  title="No scenarios yet"
                  description="Run database init to seed scenarios, or add them from Admin. You can also generate a custom scenario from the Scenarios page."
                  action={onRefresh ? { label: 'Refresh', onClick: () => onRefresh() } : undefined}
                />
              </div>
            ) : (
              <div className="space-y-8">
                {visibleCategoryIds.map((catId) => {
                  const list = scenariosByCategory.get(catId) ?? [];
                  const categoryName = catId === UNCATEGORIZED_KEY ? 'Uncategorized' : (categories.find((c) => c.id === catId)?.name ?? 'Uncategorized');
                  const preview = list.slice(0, SCENARIOS_PER_CATEGORY_PREVIEW);
                  const hasMore = list.length > SCENARIOS_PER_CATEGORY_PREVIEW;
                  const showViewAll = list.length > 0;
                  return (
                    <section key={catId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-800">{categoryName}</h3>
                        {showViewAll && (
                          <button
                            type="button"
                            onClick={() => onViewScenarios(catId === UNCATEGORIZED_KEY ? undefined : catId)}
                            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-2"
                          >
                            {hasMore ? `See all ${list.length}` : 'View all'}
                            <i className="fas fa-arrow-right text-xs"></i>
                          </button>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {preview.map((s) => (
                            <button
                              key={s.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onStartScenario(s);
                              }}
                              className="group p-5 rounded-xl border border-slate-100 hover:shadow-lg hover:border-emerald-200 hover:bg-emerald-50/30 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                              aria-label={`Start scenario: ${s.title}`}
                              type="button"
                            >
                              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <i className={`fas ${s.icon || 'fa-comments'} text-lg`} aria-hidden="true"></i>
                              </div>
                              <h4 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{s.title}</h4>
                              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                            </button>
                          ))}
                        </div>
                        {preview.length === 0 && (
                          <p className="text-sm text-slate-500">No scenarios in this category yet.</p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Daily Nugget Section - Hidden */}
        {/* <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
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
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default Dashboard;
