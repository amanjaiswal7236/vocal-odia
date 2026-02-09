'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Scenario } from '@/types';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';

const UNCATEGORIZED_KEY = '__uncategorized__';

function ScenariosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const { scenarios, categories, loading, refreshContent } = useAppContext();

  const filteredScenarios = useMemo(() => {
    if (!categoryParam) return scenarios;
    if (categoryParam === UNCATEGORIZED_KEY) {
      return scenarios.filter((s) => !s.categoryId);
    }
    return scenarios.filter((s) => String(s.categoryId) === categoryParam);
  }, [scenarios, categoryParam]);
  const { showToast } = useToast();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationForm, setGenerationForm] = useState({
    topic: '',
    context: '',
    difficulty: 'intermediate'
  });

  useEffect(() => {
    if (!loading && !authService.isAuthenticated()) {
      router.push('/signin');
    }
  }, [loading, router]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading scenarios..." />;
  }

  const handleBack = () => {
    router.push('/dashboard');
  };

  const handleStartScenario = (scenario: Scenario) => {
    if (scenario && scenario.id) {
      router.push(`/session/${scenario.id}`);
    }
  };

  const handleGenerateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generationForm.topic.trim()) {
      showToast('Please enter a topic for your scenario', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/content/scenarios/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof window !== 'undefined' && localStorage.getItem('token') 
            ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            : {})
        },
        body: JSON.stringify(generationForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate scenario');
      }

      showToast('Scenario generated successfully!', 'success');
      setShowGenerateModal(false);
      setGenerationForm({ topic: '', context: '', difficulty: 'intermediate' });
      
      // Refresh scenarios list
      if (refreshContent) {
        await refreshContent();
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 transition-colors" aria-label="Back">
              <i className="fas fa-arrow-left"></i>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Live Lab Scenarios</h1>
              <p className="text-sm text-slate-500 mt-0.5">Practice with AI by subject</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {categories.length > 0 && (
              <select
                value={categoryParam ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  router.push(v ? `/scenarios?category=${encodeURIComponent(v)}` : '/scenarios');
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {scenarios.some((s) => !s.categoryId) && (
                  <option value={UNCATEGORIZED_KEY}>Uncategorized</option>
                )}
              </select>
            )}
            {refreshContent && (
              <button
                type="button"
                onClick={() => refreshContent()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                title="Refresh"
              >
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            )}
            <button
              onClick={() => setShowGenerateModal(true)}
              className="bg-emerald-600 text-white font-bold py-2.5 px-5 rounded-xl shadow-md hover:bg-emerald-700 transition-all flex items-center gap-2"
            >
              <i className="fas fa-magic"></i>
              <span>Generate Custom</span>
            </button>
          </div>
        </div>

        {filteredScenarios.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100">
            <EmptyState
              icon="fa-flask"
              title={categoryParam ? 'No scenarios in this category' : 'No scenarios yet'}
              description={categoryParam ? 'Switch to another category or view all.' : 'Run database init to seed data, or create scenarios from Admin.'}
              action={{
                label: categoryParam ? 'View all' : 'Go to Dashboard',
                onClick: () => (categoryParam ? router.push('/scenarios') : handleBack()),
              }}
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => handleStartScenario(scenario)}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-emerald-200 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 overflow-hidden"
                aria-label={`Start scenario: ${scenario.title}`}
                type="button"
              >
                {scenario.image ? (
                  <div className="w-full h-36 rounded-t-2xl overflow-hidden bg-slate-100">
                    <img
                      src={scenario.image}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 rounded-t-2xl bg-slate-50 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <i className={`fas ${scenario.icon || 'fa-comments'} text-xl`}></i>
                    </span>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors leading-tight">
                      {scenario.title}
                    </h3>
                    {scenario.category && (
                      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                        {scenario.category.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed">
                    {scenario.description}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Start practice</span>
                    <i className="fas fa-arrow-right text-xs"></i>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Generate Scenario Modal */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in duration-300">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <i className="fas fa-magic text-green-600"></i>
                  Generate Custom Scenario
                </h2>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-times text-gray-500"></i>
                </button>
              </div>

              <form onSubmit={handleGenerateScenario} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Topic <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={generationForm.topic}
                    onChange={(e) => setGenerationForm({ ...generationForm, topic: e.target.value })}
                    placeholder="e.g., Job Interview, Restaurant Ordering, Doctor Visit"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-gray-500 mt-1">What scenario would you like to practice?</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Additional Context (Optional)
                  </label>
                  <textarea
                    value={generationForm.context}
                    onChange={(e) => setGenerationForm({ ...generationForm, context: e.target.value })}
                    placeholder="e.g., Tech startup interview, Local restaurant, Clinic visit"
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-gray-500 mt-1">Add any specific details or context for the scenario</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={generationForm.difficulty}
                    onChange={(e) => setGenerationForm({ ...generationForm, difficulty: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={isGenerating}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    disabled={isGenerating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin"></i>
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-magic"></i>
                        <span>Generate Scenario</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScenariosPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen text="Loading scenarios..." />}>
      <ScenariosContent />
    </Suspense>
  );
}
