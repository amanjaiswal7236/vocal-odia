
'use client';

import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Scenario, DailyNugget, UsageStats, UserUsage, Course, CourseLevel, Module, Lesson } from '@/types';
import { contentService } from '@/lib/services/contentService';

interface AdminDashboardProps {
  scenarios: Scenario[];
  nuggets: DailyNugget[];
  courses: Course[];
  stats: UsageStats;
  users: UserUsage[];
  onUpdateScenarios: (scenarios: Scenario[]) => void;
  onUpdateNuggets: (nuggets: DailyNugget[]) => void;
  onUpdateCourses: (courses: Course[]) => void;
  onExit: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  scenarios, 
  nuggets, 
  courses,
  stats, 
  users,
  onUpdateScenarios, 
  onUpdateNuggets,
  onUpdateCourses,
  onExit 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'scenarios' | 'nuggets' | 'courses'>('overview');
  
  // Scenarios State
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [newScenario, setNewScenario] = useState({ title: '', description: '', icon: 'fa-comments', prompt: '' });

  // Courses State
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [isGeneratingCurriculum, setIsGeneratingCurriculum] = useState(false);
  const [newCourse, setNewCourse] = useState<Partial<Course>>({
    title: '',
    description: '',
    level: CourseLevel.BEGINNER,
    modules: []
  });

  const handleAddScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenario.title || !newScenario.description || !newScenario.prompt) return;
    try {
      const created = await contentService.createScenario(newScenario);
      onUpdateScenarios([...scenarios, { ...created, id: created.id.toString() }]);
      setIsAddingScenario(false);
      setNewScenario({ title: '', description: '', icon: 'fa-comments', prompt: '' });
    } catch (error) {
      console.error('Failed to create scenario:', error);
      alert('Failed to create scenario');
    }
  };

  const handleGenerateCurriculum = async () => {
    if (!newCourse.title || !newCourse.level) {
      alert("Please provide a title and level first.");
      return;
    }
    
    setIsGeneratingCurriculum(true);
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a structured curriculum for an Odia-English learner for a course titled "${newCourse.title}" at ${newCourse.level} level. 
        Focus on fixing "Odinglish" translation patterns. 
        Return JSON containing an array of modules, where each module has lessons (id, title, objective, prompt, completed: false).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                lessons: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      objective: { type: Type.STRING },
                      prompt: { type: Type.STRING },
                      completed: { type: Type.BOOLEAN }
                    },
                    required: ["id", "title", "objective", "prompt", "completed"]
                  }
                }
              },
              required: ["id", "title", "lessons"]
            }
          }
        }
      });

      const modules = JSON.parse(response.text || '[]');
      setNewCourse(prev => ({ ...prev, modules }));
    } catch (e) {
      console.error("AI Generation failed", e);
      alert("Failed to generate curriculum with AI. Please try again.");
    } finally {
      setIsGeneratingCurriculum(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!newCourse.title || !newCourse.modules || newCourse.modules.length === 0) {
      alert("Please ensure the course has a title and curriculum.");
      return;
    }
    try {
      const created = await contentService.createCourse({
        title: newCourse.title!,
        description: newCourse.description || '',
        level: newCourse.level,
        modules: newCourse.modules as Module[],
        is_unlocked: courses.length === 0
      });
      onUpdateCourses([...courses, {
        id: created.id.toString(),
        title: created.title,
        level: created.level,
        description: created.description,
        modules: [],
        isUnlocked: created.is_unlocked
      }]);
      setIsAddingCourse(false);
      setNewCourse({ title: '', description: '', level: CourseLevel.BEGINNER, modules: [] });
    } catch (error) {
      console.error('Failed to create course:', error);
      alert('Failed to create course');
    }
  };

  const removeScenario = async (id: string) => {
    try {
      await contentService.deleteScenario(parseInt(id));
      onUpdateScenarios(scenarios.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete scenario:', error);
      alert('Failed to delete scenario');
    }
  };
  
  const removeNugget = async (id: number) => {
    try {
      await contentService.deleteNugget(id);
      onUpdateNuggets(nuggets.filter(n => n.word !== nuggets.find(n2 => (n2 as any).id === id)?.word));
    } catch (error) {
      console.error('Failed to delete nugget:', error);
      alert('Failed to delete nugget');
    }
  };
  
  const removeCourse = async (id: string) => {
    try {
      await contentService.deleteCourse(parseInt(id));
      onUpdateCourses(courses.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete course:', error);
      alert('Failed to delete course');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden min-h-[600px] animate-in fade-in zoom-in duration-300">
      <div className="flex border-b bg-gray-50/30 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('overview')} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-chart-pie mr-2"></i> Overview
        </button>
        <button onClick={() => setActiveTab('users')} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-users mr-2"></i> Users
        </button>
        <button onClick={() => { setActiveTab('courses'); setIsAddingCourse(false); }} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'courses' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-graduation-cap mr-2"></i> Courses
        </button>
        <button onClick={() => { setActiveTab('scenarios'); setIsAddingScenario(false); }} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'scenarios' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-list mr-2"></i> Scenarios
        </button>
        <button onClick={() => setActiveTab('nuggets')} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'nuggets' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-brain mr-2"></i> Nuggets
        </button>
        <div className="flex-1"></div>
        <button onClick={onExit} className="px-6 py-4 text-gray-400 hover:text-red-500 transition-colors">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="p-8">
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Estimated Tokens</p>
                <p className="text-3xl font-black text-blue-900">{stats.tokensUsed.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">Total Sessions</p>
                <p className="text-3xl font-black text-indigo-900">{stats.sessionsCount}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                <p className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Unique Users</p>
                <p className="text-3xl font-black text-green-900">{users.length}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                <p className="text-orange-600 text-xs font-bold uppercase tracking-wider mb-1">Active Now</p>
                <p className="text-3xl font-black text-orange-900">1</p>
              </div>
            </div>
            {/* Visualizer Mock */}
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <h3 className="font-bold mb-4">Real-time Usage Velocity</h3>
              <div className="flex items-end gap-1 h-32">
                {[40, 60, 30, 80, 50, 90, 100, 70, 85, 45, 65, 55].map((val, i) => (
                  <div key={i} className="flex-1 bg-indigo-200 rounded-t-sm" style={{ height: `${val}%` }}></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {!isAddingCourse ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">Platform Courses</h3>
                  <button onClick={() => setIsAddingCourse(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95">
                    + Create New Course
                  </button>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map(c => (
                    <div key={c.id} className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm relative group">
                      <div className="flex justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-1 rounded">{c.level}</span>
                        <button onClick={() => removeCourse(c.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-trash"></i></button>
                      </div>
                      <h4 className="font-bold text-gray-900">{c.title}</h4>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{c.description}</p>
                      <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase">
                        <i className="fas fa-layer-group"></i> {c.modules.length} Modules
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="max-w-3xl mx-auto bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setIsAddingCourse(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-arrow-left"></i></button>
                  <h3 className="font-bold text-xl text-gray-900">New Course Designer</h3>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Course Title</label>
                      <input type="text" value={newCourse.title} onChange={e => setNewCourse({...newCourse, title: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none" placeholder="e.g. Master Interviews" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Level</label>
                      <select value={newCourse.level} onChange={e => setNewCourse({...newCourse, level: e.target.value as CourseLevel})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none">
                        <option value={CourseLevel.BEGINNER}>Beginner</option>
                        <option value={CourseLevel.INTERMEDIATE}>Intermediate</option>
                        <option value={CourseLevel.ADVANCED}>Advanced</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Description</label>
                    <textarea value={newCourse.description} onChange={e => setNewCourse({...newCourse, description: e.target.value})} rows={2} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none resize-none" placeholder="Briefly describe what students will learn..." />
                  </div>

                  <div className="bg-indigo-600/5 p-6 rounded-2xl border border-indigo-100">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-indigo-900">Curriculum Structure</h4>
                      <button 
                        onClick={handleGenerateCurriculum}
                        disabled={isGeneratingCurriculum}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingCurriculum ? <><i className="fas fa-circle-notch animate-spin"></i> Generating...</> : <><i className="fas fa-wand-magic-sparkles"></i> AI Assist Build</>}
                      </button>
                    </div>
                    {newCourse.modules && newCourse.modules.length > 0 ? (
                      <div className="space-y-4 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                        {newCourse.modules.map((m, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100">
                            <p className="font-black text-xs text-indigo-400 mb-1 uppercase">Module {idx+1}</p>
                            <p className="font-bold text-sm text-gray-900">{m.title}</p>
                            <p className="text-[10px] text-gray-500 mt-1">{m.lessons.length} Lessons Generated</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-400">
                        <p className="text-sm font-medium">No curriculum yet. Use AI Assist to build one based on your topic!</p>
                      </div>
                    )}
                  </div>

                  <button onClick={handleSaveCourse} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-[0.98]">
                    Save & Publish Course
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <i className="fas fa-id-badge text-indigo-600"></i> Consumption Stats
            </h3>
            <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Tokens</th>
                    <th className="px-6 py-4">Sessions</th>
                    <th className="px-6 py-4">Last Active</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <img src={u.avatar} className="w-8 h-8 rounded-full" />
                        <span className="font-bold">{u.name}</span>
                      </td>
                      <td className="px-6 py-4 font-black">{u.tokens.toLocaleString()}</td>
                      <td className="px-6 py-4">{u.sessions}</td>
                      <td className="px-6 py-4 text-gray-400">{formatDate(u.lastActive)}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg"><i className="fas fa-chevron-right"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {!isAddingScenario ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">Active Scenarios</h3>
                  <button onClick={() => setIsAddingScenario(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                    <i className="fas fa-plus"></i> Add New Scenario
                  </button>
                </div>
                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-4">Title</th>
                        <th className="px-6 py-4">Icon</th>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {scenarios.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900">{s.title}</td>
                          <td className="px-6 py-4"><i className={`fas ${s.icon} text-indigo-600`}></i></td>
                          <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{s.description}</td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg mr-2"><i className="fas fa-edit"></i></button>
                            <button onClick={() => removeScenario(s.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><i className="fas fa-trash"></i></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="max-w-2xl mx-auto bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setIsAddingScenario(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-arrow-left"></i></button>
                  <h3 className="font-bold text-xl text-gray-900">Configure New Scenario</h3>
                </div>
                <form onSubmit={handleAddScenario} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-2">Title</label>
                      <input type="text" required value={newScenario.title} onChange={e => setNewScenario({...newScenario, title: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-2">Icon (FA Class)</label>
                      <input type="text" required value={newScenario.icon} onChange={e => setNewScenario({...newScenario, icon: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-2">Description</label>
                    <input type="text" required value={newScenario.description} onChange={e => setNewScenario({...newScenario, description: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-2">AI Instruction Prompt</label>
                    <textarea required value={newScenario.prompt} onChange={e => setNewScenario({...newScenario, prompt: e.target.value})} rows={4} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium resize-none" />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Save Scenario</button>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'nuggets' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Daily Nuggets</h3>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">+ Add Word</button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nuggets.map((n, i) => (
                <div key={i} className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all group relative">
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => removeNugget((n as any).id || 0)} className="text-gray-300 hover:text-red-500"><i className="fas fa-times-circle"></i></button>
                  </div>
                  <p className="text-lg font-black text-indigo-600 mb-1">{n.word}</p>
                  <p className="text-xs text-gray-400 font-medium mb-3 italic">"{n.example}"</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{n.definition}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
