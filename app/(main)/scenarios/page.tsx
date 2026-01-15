'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/services/authService';
import { useAppContext } from '@/lib/context/AppContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Scenario } from '@/types';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/errorHandler';
import { contentService } from '@/lib/services/contentService';

export default function ScenariosPage() {
  const router = useRouter();
  const { scenarios, loading, refreshContent } = useAppContext();
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8 animate-in zoom-in duration-300">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <i className="fas fa-arrow-left text-gray-600"></i>
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Live Lab Scenarios</h1>
              <p className="text-sm text-gray-500 mt-1">Practice real-world conversations with AI</p>
            </div>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <i className="fas fa-magic"></i>
            <span>Generate Custom</span>
          </button>
        </div>

        {scenarios.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100">
            <EmptyState
              icon="fa-comments"
              title="No scenarios available"
              description="Scenarios will appear here when available"
              action={{ label: "Go Back", onClick: handleBack }}
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => handleStartScenario(scenario)}
                className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 text-left transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label={`Start scenario: ${scenario.title}`}
                type="button"
              >
                {scenario.image && (
                  <div className="w-full h-40 rounded-xl overflow-hidden mb-4 bg-gray-100">
                    <img
                      src={scenario.image}
                      alt={scenario.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <i className={`fas ${scenario.icon} text-xl`} aria-hidden="true"></i>
                </div>
                <h3 className="font-bold text-gray-900 group-hover:text-green-600 transition-colors mb-2">
                  {scenario.title}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
                  {scenario.description}
                </p>
                <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Start Practice</span>
                  <i className="fas fa-arrow-right"></i>
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
                    placeholder="e.g., Tech startup interview, Local Odia restaurant, Clinic in Bhubaneswar"
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
