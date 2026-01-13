'use client';

import React, { useState } from 'react';
import { Course, Lesson, CourseLevel } from '@/types';

interface CourseMapProps {
  courses: Course[];
  onSelectLesson: (courseId: string, lesson: Lesson) => void;
  onBack: () => void;
}

const CourseMap: React.FC<CourseMapProps> = ({ courses, onSelectLesson, onBack }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(courses.find(c => c.isUnlocked)?.id || null);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500 pb-12">
      <div className="flex items-center gap-4">
        <button type="button" onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
          <i className="fas fa-arrow-left text-gray-600"></i>
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Learning Path</h1>
          <p className="text-sm text-gray-500 font-medium">Step-by-step AI guided progression</p>
        </div>
      </div>

      {/* Course Selector Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar">
        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            disabled={!course.isUnlocked}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedCourseId(course.id);
            }}
            className={`flex-shrink-0 p-5 rounded-2xl border-2 transition-all w-64 ${
              selectedCourseId === course.id 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                : !course.isUnlocked 
                  ? 'bg-gray-50 border-gray-100 opacity-60 grayscale cursor-not-allowed'
                  : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${selectedCourseId === course.id ? 'bg-white/20' : 'bg-gray-100'}`}>
                {course.level}
              </span>
              {!course.isUnlocked && <i className="fas fa-lock text-sm"></i>}
            </div>
            <h3 className="font-bold text-left">{course.title}</h3>
            <p className={`text-[10px] mt-2 text-left leading-tight ${selectedCourseId === course.id ? 'text-indigo-100' : 'text-gray-400'}`}>
              {course.description}
            </p>
          </button>
        ))}
      </div>

      {selectedCourse && (
        <div className="space-y-12 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-indigo-100 animate-in fade-in slide-in-from-top duration-300">
          {selectedCourse.modules.map((module, mIdx) => (
            <div key={module.id} className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-indigo-600 border-4 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
                  {mIdx + 1}
                </div>
                <h2 className="text-lg font-extrabold text-indigo-900 uppercase tracking-wider">{module.title}</h2>
              </div>

              <div className="grid gap-4 ml-12">
                {module.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onSelectLesson(selectedCourse.id, lesson)}
                    className={`p-6 rounded-2xl border text-left transition-all ${
                      lesson.completed 
                        ? 'bg-green-50 border-green-100' 
                        : 'bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          {lesson.title}
                          {lesson.completed && <i className="fas fa-check-circle text-green-500"></i>}
                        </h3>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-lg">
                          {lesson.objective}
                        </p>
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${lesson.completed ? 'bg-green-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                        <i className={`fas ${lesson.completed ? 'fa-redo' : 'fa-play'} text-xs`}></i>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseMap;
