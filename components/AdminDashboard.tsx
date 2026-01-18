
'use client';

import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Scenario, DailyNugget, UsageStats, UserUsage, Course, CourseLevel, Module, Lesson, UserSession } from '@/types';
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Array<{ id: string; text: string; sender: 'user' | 'ai'; timestamp: number; audioUrl?: string | null }>>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  
  // Scenarios State
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [newScenario, setNewScenario] = useState({ title: '', description: '', icon: 'fa-comments', prompt: '', image: '' });

  // Courses State
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
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
      if (editingScenario) {
        // Update existing scenario
        const updated = await contentService.updateScenario(parseInt(editingScenario.id), newScenario);
        onUpdateScenarios(scenarios.map(s => s.id === editingScenario.id 
          ? { ...updated, id: updated.id.toString(), image: updated.image || undefined }
          : s
        ));
        setEditingScenario(null);
      } else {
        // Create new scenario
        const created = await contentService.createScenario(newScenario);
        onUpdateScenarios([...scenarios, { ...created, id: created.id.toString(), image: created.image || undefined }]);
      }
      setIsAddingScenario(false);
      setNewScenario({ title: '', description: '', icon: 'fa-comments', prompt: '', image: '' });
    } catch (error) {
      console.error('Failed to save scenario:', error);
      alert('Failed to save scenario');
    }
  };

  const handleEditScenario = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setNewScenario({
      title: scenario.title,
      description: scenario.description,
      icon: scenario.icon,
      prompt: scenario.prompt,
      image: scenario.image || ''
    });
    setIsAddingScenario(true);
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
    if (!newCourse.title) {
      alert("Please provide a course title.");
      return;
    }
    if (editingCourse && (!newCourse.modules || newCourse.modules.length === 0)) {
      // Allow saving without modules when editing (preserve existing)
      const courseData = courses.find(c => c.id === editingCourse.id);
      if (courseData && courseData.modules.length > 0) {
        newCourse.modules = courseData.modules;
      }
    }
    if (!newCourse.modules || newCourse.modules.length === 0) {
      alert("Please ensure the course has a curriculum.");
      return;
    }
    try {
      if (editingCourse) {
        // Update existing course
        const updated = await contentService.updateCourse(parseInt(editingCourse.id), {
          title: newCourse.title!,
          description: newCourse.description || '',
          level: newCourse.level,
          modules: newCourse.modules as Module[],
          is_unlocked: editingCourse.isUnlocked
        });
        // Reload courses to get updated data
        const allCourses = await contentService.getCourses();
        const transformedCourses = allCourses.map((c: any) => ({
          id: c.id.toString(),
          title: c.title,
          level: c.level,
          description: c.description,
          prerequisiteId: c.prerequisite_id ? c.prerequisite_id.toString() : undefined,
          isUnlocked: c.is_unlocked,
          modules: c.modules.map((m: any) => ({
            id: m.id.toString(),
            title: m.title,
            lessons: m.lessons.map((l: any) => ({
              id: l.id.toString(),
              title: l.title,
              objective: l.objective,
              prompt: l.prompt,
              completed: l.completed || false
            }))
          }))
        }));
        onUpdateCourses(transformedCourses);
        setEditingCourse(null);
      } else {
        // Create new course
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
      }
      setIsAddingCourse(false);
      setNewCourse({ title: '', description: '', level: CourseLevel.BEGINNER, modules: [] });
    } catch (error) {
      console.error('Failed to save course:', error);
      alert('Failed to save course');
    }
  };

  const handleEditCourse = async (course: Course) => {
    try {
      // Fetch full course data with modules
      const allCourses = await contentService.getCourses();
      const fullCourse = allCourses.find((c: any) => c.id.toString() === course.id);
      
      if (fullCourse) {
        setEditingCourse(course);
        setNewCourse({
          title: fullCourse.title,
          description: fullCourse.description,
          level: fullCourse.level,
          modules: fullCourse.modules.map((m: any) => ({
            id: m.id.toString(),
            title: m.title,
            lessons: m.lessons.map((l: any) => ({
              id: l.id.toString(),
              title: l.title,
              objective: l.objective,
              prompt: l.prompt,
              completed: l.completed || false
            }))
          }))
        });
        setIsAddingCourse(true);
      }
    } catch (error) {
      console.error('Failed to load course for editing:', error);
      alert('Failed to load course data');
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
        <button onClick={() => setActiveTab('overview')} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'text-green-600 border-b-2 border-green-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-chart-pie mr-2"></i> Overview
        </button>
        <button onClick={() => setActiveTab('users')} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'users' ? 'text-green-600 border-b-2 border-green-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-users mr-2"></i> Users
        </button>
        <button onClick={() => { setActiveTab('courses'); setIsAddingCourse(false); setEditingCourse(null); }} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'courses' ? 'text-green-600 border-b-2 border-green-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-graduation-cap mr-2"></i> Courses
        </button>
        <button onClick={() => { setActiveTab('scenarios'); setIsAddingScenario(false); setEditingScenario(null); }} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'scenarios' ? 'text-green-600 border-b-2 border-green-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <i className="fas fa-list mr-2"></i> Scenarios
        </button>
        <button onClick={() => setActiveTab('nuggets')} className={`px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'nuggets' ? 'text-green-600 border-b-2 border-green-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
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
                <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Total Tokens Used</p>
                <p className="text-3xl font-black text-blue-900">{stats.tokensUsed.toLocaleString()}</p>
                <p className="text-xs text-blue-600 mt-1">From all sessions</p>
              </div>
              <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                <p className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Total Sessions</p>
                <p className="text-3xl font-black text-green-900">{stats.sessionsCount}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                <p className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Unique Users</p>
                <p className="text-3xl font-black text-green-900">{stats.uniqueUsers || users.length}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                <p className="text-orange-600 text-xs font-bold uppercase tracking-wider mb-1">Active Now</p>
                <p className="text-3xl font-black text-orange-900">1</p>
              </div>
            </div>
            {/* Token Usage Over Time Chart */}
            {Array.isArray(stats.dailyTokens) && stats.dailyTokens.length > 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <i className="fas fa-chart-line text-green-600"></i>
                  Token Usage (Last 7 Days)
                </h3>
                <div className="flex items-end gap-2 h-48 pb-8">
                  {stats.dailyTokens.map((day, i) => {
                    const maxTokens = Math.max(...stats.dailyTokens!.map(d => d.tokens), 1);
                    const heightPercent = maxTokens > 0 ? (day.tokens / maxTokens) * 100 : 0;
                    // Ensure minimum visible height of 20px or 10% whichever is larger
                    const minHeight = Math.max(20, (192 * 0.1)); // 10% of 192px (h-48 = 192px)
                    const height = Math.max(heightPercent, (minHeight / 192) * 100);
                    const date = new Date(day.date);
                    const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center group relative h-full">
                        <div className="flex-1 flex items-end w-full">
                          <div 
                            className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg transition-all hover:from-green-700 hover:to-green-500 cursor-pointer min-h-[20px]"
                            style={{ height: `${height}%` }}
                            title={`${dayLabel}: ${day.tokens.toLocaleString()} tokens`}
                          >
                          </div>
                        </div>
                        <div className="mt-2 text-xs font-medium text-gray-500 text-center whitespace-nowrap">
                          {dayLabel}
                        </div>
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                          {day.tokens.toLocaleString()} tokens
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>Total: {stats.dailyTokens.reduce((sum, d) => sum + d.tokens, 0).toLocaleString()} tokens</span>
                  <span>Avg: {Math.round(stats.dailyTokens.reduce((sum, d) => sum + d.tokens, 0) / stats.dailyTokens.length).toLocaleString()} tokens/day</span>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <i className="fas fa-chart-line text-green-600"></i>
                  Token Usage (Last 7 Days)
                </h3>
                <div className="text-center py-12 text-gray-400">
                  <i className="fas fa-chart-bar text-4xl mb-4"></i>
                  <p className="text-sm">No token usage data available for the last 7 days</p>
                </div>
              </div>
            )}

            {/* Top Users by Token Usage */}
            {Array.isArray(stats.userTokens) && stats.userTokens.length > 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <i className="fas fa-users text-green-600"></i>
                  Top Users by Token Usage
                </h3>
                <div className="space-y-3">
                  {stats.userTokens.map((user, i) => {
                    const maxTokens = Math.max(...stats.userTokens!.map(u => u.tokens), 1);
                    const width = maxTokens > 0 ? (user.tokens / maxTokens) * 100 : 0;
                    return (
                      <div key={user.userId} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <span className="text-xs font-black text-gray-400 w-4">#{i + 1}</span>
                          <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                          <span className="text-sm font-bold text-gray-900 truncate max-w-[100px]">{user.name}</span>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${width}%` }}
                          >
                            {width > 15 && (
                              <span className="text-xs font-bold text-white">
                                {user.tokens.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {width <= 15 && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">
                              {user.tokens.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-gray-500 min-w-[60px] text-right">
                          {user.sessions} sessions
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <i className="fas fa-users text-green-600"></i>
                  Top Users by Token Usage
                </h3>
                <div className="text-center py-12 text-gray-400">
                  <i className="fas fa-user-slash text-4xl mb-4"></i>
                  <p className="text-sm">No user token data available</p>
                </div>
              </div>
            )}

            {/* Sessions Over Time (if we have daily data) */}
            {Array.isArray(stats.dailyTokens) && stats.dailyTokens.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <i className="fas fa-calendar-alt text-green-600"></i>
                  Daily Activity Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.dailyTokens.slice(-4).map((day, i) => {
                    const date = new Date(day.date);
                    const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div key={i} className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                        <p className="text-xs font-bold text-green-600 uppercase mb-1">{dayLabel}</p>
                        <p className="text-2xl font-black text-green-900">{day.tokens.toLocaleString()}</p>
                        <p className="text-xs text-green-600 mt-1">tokens used</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {!isAddingCourse ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">Platform Courses</h3>
                  <button onClick={() => {
                    setEditingCourse(null);
                    setNewCourse({ title: '', description: '', level: CourseLevel.BEGINNER, modules: [] });
                    setIsAddingCourse(true);
                  }} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-green-700 transition-all active:scale-95">
                    + Create New Course
                  </button>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map(c => (
                    <div key={c.id} className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm relative group">
                      <div className="flex justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-green-50 text-green-600 px-2 py-1 rounded">{c.level}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEditCourse(c)} 
                            className="text-gray-300 hover:text-blue-500"
                            title="Edit course"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            onClick={() => removeCourse(c.id)} 
                            className="text-gray-300 hover:text-red-500"
                            title="Delete course"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                      <h4 className="font-bold text-gray-900">{c.title}</h4>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{c.description}</p>
                      <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase">
                        <i className="fas fa-layer-group"></i> {c.modules.length} Modules
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="max-w-3xl mx-auto bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => {
                    setIsAddingCourse(false);
                    setEditingCourse(null);
                    setNewCourse({ title: '', description: '', level: CourseLevel.BEGINNER, modules: [] });
                  }} className="text-gray-400 hover:text-gray-600 transition-colors"><i className="fas fa-arrow-left"></i></button>
                  <h3 className="font-bold text-xl text-gray-900">{editingCourse ? 'Edit Course' : 'New Course Designer'}</h3>
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

                  <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-green-900">Curriculum Structure</h4>
                      <button 
                        onClick={handleGenerateCurriculum}
                        disabled={isGeneratingCurriculum}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-md hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingCurriculum ? <><i className="fas fa-circle-notch animate-spin"></i> Generating...</> : <><i className="fas fa-wand-magic-sparkles"></i> AI Assist Build</>}
                      </button>
                    </div>
                    {newCourse.modules && newCourse.modules.length > 0 ? (
                      <div className="space-y-4 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                        {newCourse.modules.map((m, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100">
                            <p className="font-black text-xs text-green-600 mb-1 uppercase">Module {idx+1}</p>
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
                    {editingCourse ? 'Update Course' : 'Save & Publish Course'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {selectedSessionId ? (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <button 
                    onClick={() => {
                      setSelectedSessionId(null);
                      setSessionMessages([]);
                      setSelectedSession(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <i className="fas fa-comments text-indigo-600"></i> 
                    Conversation: {selectedSession?.scenarioTitle || 'Session'}
                  </h3>
                </div>
                {loadingMessages ? (
                  <div className="text-center py-12 text-gray-400">
                    <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Loading conversation...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Session Audio Player */}
                    {selectedSession?.sessionAudioUrl && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100">
                        <div className="flex items-center gap-3 mb-3">
                          <i className="fas fa-headphones text-indigo-600 text-xl"></i>
                          <h4 className="font-bold text-indigo-900">Full Session Audio</h4>
                        </div>
                        <audio 
                          controls 
                          src={selectedSession.sessionAudioUrl}
                          className="w-full mt-2"
                          preload="metadata"
                        >
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    )}
                    
                    {/* Messages */}
                    {sessionMessages.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <i className="fas fa-comment-slash text-4xl mb-4"></i>
                        <p>No messages found in this session</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sessionMessages.map((message, index) => (
                          <div 
                            key={message.id || index}
                            className={`p-4 rounded-2xl border ${
                              message.sender === 'user' 
                                ? 'bg-blue-50 border-blue-100 ml-8' 
                                : 'bg-green-50 border-green-100 mr-8'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                message.sender === 'user' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-green-600 text-white'
                              }`}>
                                <i className={`fas ${message.sender === 'user' ? 'fa-user' : 'fa-robot'} text-xs`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-bold text-sm text-gray-900">
                                    {message.sender === 'user' ? 'User' : 'AI Assistant'}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {formatDate(message.timestamp)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap break-words">
                                  {message.text}
                                </p>
                                {message.audioUrl && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <audio 
                                      controls 
                                      src={message.audioUrl}
                                      className="w-full"
                                      preload="metadata"
                                    >
                                      Your browser does not support the audio element.
                                    </audio>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedUserId ? (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <button 
                    onClick={() => {
                      setSelectedUserId(null);
                      setUserSessions([]);
                      setSelectedSessionId(null);
                      setSessionMessages([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <i className="fas fa-history text-indigo-600"></i> 
                    User Sessions: {users.find(u => u.id === selectedUserId)?.name || 'Unknown'}
                  </h3>
                </div>
                {loadingSessions ? (
                  <div className="text-center py-12 text-gray-400">
                    <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Loading sessions...</p>
                  </div>
                ) : userSessions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <i className="fas fa-inbox text-4xl mb-4"></i>
                    <p>No sessions found for this user</p>
                  </div>
                ) : (
                  <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase">
                        <tr>
                          <th className="px-6 py-4">Session</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Tokens</th>
                          <th className="px-6 py-4">Duration</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                        {userSessions.map(session => (
                          <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-bold">{session.scenarioTitle}</td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${session.isCourseLesson ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {session.isCourseLesson ? 'Course' : 'Scenario'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-black">{session.tokensUsed.toLocaleString()}</td>
                            <td className="px-6 py-4 text-gray-500">
                              {session.durationSeconds > 0 
                                ? `${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s`
                                : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-gray-400">{formatDate(session.startedAt)}</td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={async () => {
                                  setSelectedSessionId(session.id);
                                  setSelectedSession(session);
                                  setLoadingMessages(true);
                                  try {
                                    const messages = await contentService.getSessionMessages(parseInt(session.id));
                                    setSessionMessages(messages);
                                  } catch (error) {
                                    console.error('Failed to load messages:', error);
                                    setSessionMessages([]);
                                  } finally {
                                    setLoadingMessages(false);
                                  }
                                }}
                                className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg"
                                title="View conversation"
                              >
                                <i className="fas fa-comments"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <>
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
                            <button 
                              onClick={async () => {
                                setSelectedUserId(u.id);
                                setLoadingSessions(true);
                                try {
                                  const sessions = await contentService.getUserSessions(parseInt(u.id));
                                  setUserSessions(sessions);
                                } catch (error) {
                                  console.error('Failed to load sessions:', error);
                                  setUserSessions([]);
                                } finally {
                                  setLoadingSessions(false);
                                }
                              }}
                              className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg"
                            >
                              <i className="fas fa-chevron-right"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {!isAddingScenario ? (
              <>
                <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-6 text-white mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-xl mb-1">Active Scenarios</h3>
                      <p className="text-slate-200 text-sm">Manage conversation practice scenarios</p>
                    </div>
                    <button onClick={() => {
                      setEditingScenario(null);
                      setNewScenario({ title: '', description: '', icon: 'fa-comments', prompt: '', image: '' });
                      setIsAddingScenario(true);
                    }} className="bg-green-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-green-600 transition-all flex items-center gap-2 active:scale-95">
                      <i className="fas fa-plus"></i> Add New Scenario
                    </button>
                  </div>
                </div>
                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800 text-white text-xs font-bold uppercase">
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
                          <td className="px-6 py-4"><i className={`fas ${s.icon} text-green-600`}></i></td>
                          <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{s.description}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleEditScenario(s)}
                              className="text-green-600 hover:bg-green-50 p-2 rounded-lg mr-2"
                              title="Edit scenario"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button 
                              onClick={() => removeScenario(s.id)} 
                              className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                              title="Delete scenario"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 border border-gray-100 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 p-6 -m-8 mb-6 text-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => {
                      setIsAddingScenario(false);
                      setEditingScenario(null);
                      setNewScenario({ title: '', description: '', icon: 'fa-comments', prompt: '', image: '' });
                    }} className="text-slate-200 hover:text-white transition-colors"><i className="fas fa-arrow-left"></i></button>
                    <h3 className="font-bold text-xl">{editingScenario ? 'Edit Scenario' : 'Configure New Scenario'}</h3>
                  </div>
                </div>
                <form onSubmit={handleAddScenario} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-2">Title</label>
                      <input type="text" required value={newScenario.title} onChange={e => setNewScenario({...newScenario, title: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-2">Icon (FA Class)</label>
                      <input type="text" required value={newScenario.icon} onChange={e => setNewScenario({...newScenario, icon: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-2">Description</label>
                    <input type="text" required value={newScenario.description} onChange={e => setNewScenario({...newScenario, description: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-2">AI Instruction Prompt</label>
                    <textarea required value={newScenario.prompt} onChange={e => setNewScenario({...newScenario, prompt: e.target.value})} rows={4} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-2">Image URL (Optional)</label>
                    <input type="url" value={newScenario.image} onChange={e => setNewScenario({...newScenario, image: e.target.value})} placeholder="https://example.com/image.jpg" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-medium" />
                    <p className="text-xs text-gray-400 mt-1">Provide an image URL that represents this scenario</p>
                  </div>
                  <button type="submit" className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-green-700 transition-all active:scale-95">
                    {editingScenario ? 'Update Scenario' : 'Save Scenario'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'nuggets' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xl mb-1">Daily Nuggets</h3>
                  <p className="text-slate-200 text-sm">Manage daily vocabulary words for learners</p>
                </div>
                <button className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-green-600 transition-all flex items-center gap-2">
                  <i className="fas fa-plus"></i> Add Word
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nuggets.map((n, i) => (
                <div key={i} className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-green-200 transition-all group relative">
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => removeNugget((n as any).id || 0)} className="text-gray-300 hover:text-red-500"><i className="fas fa-times-circle"></i></button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                      <i className="fas fa-book text-lg"></i>
                    </div>
                    <p className="text-lg font-black text-green-600">{n.word}</p>
                  </div>
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
