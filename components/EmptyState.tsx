'use client';

import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon = 'fa-inbox', 
  title, 
  description,
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
        <i className={`fas ${icon} text-slate-400 text-2xl`}></i>
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

