'use client';

import React from 'react';
import { CourseFeedback } from '@/types';

interface CourseFeedbackViewProps {
  feedback: CourseFeedback;
  courseTitle: string;
  onContinue: () => void;
}

const CourseFeedbackView: React.FC<CourseFeedbackViewProps> = ({ feedback, courseTitle, onContinue }) => {
  return (
    <div className="max-w-3xl mx-auto py-8 animate-in fade-in slide-in-from-bottom duration-700">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-slate-800 p-8 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30">
              <i className="fas fa-medal text-4xl"></i>
            </div>
            <h1 className="text-3xl font-black">Course Completed!</h1>
            <p className="text-slate-200 font-medium">Linguistic Analysis for: {courseTitle}</p>
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <i className="fas fa-certificate text-9xl"></i>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <i className="fas fa-quote-left text-green-600"></i> Priya's Summary
            </h2>
            <div className="p-5 bg-green-50/50 rounded-2xl border border-green-100 leading-relaxed text-gray-700 italic">
              "{feedback.summary}"
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-green-50 p-6 rounded-2xl border border-green-100">
              <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                <i className="fas fa-check-circle"></i> Key Strengths
              </h3>
              <ul className="space-y-2">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-green-400 flex-shrink-0"></span>
                    {s}
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
              <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                <i className="fas fa-lightbulb"></i> Growth Areas
              </h3>
              <ul className="space-y-2">
                {feedback.improvementAreas.map((s, i) => (
                  <li key={i} className="text-sm text-orange-700 flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-orange-400 flex-shrink-0"></span>
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Next Milestone</h2>
            <p className="text-gray-700 font-medium">{feedback.nextSteps}</p>
          </section>

          <button 
            onClick={onContinue}
            className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-green-700 transition-all active:scale-[0.98]"
          >
            Unlock Next Course
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseFeedbackView;
