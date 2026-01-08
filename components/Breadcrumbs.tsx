'use client';

import React from 'react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <i className="fas fa-chevron-right text-gray-400 text-xs"></i>}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="text-gray-500 hover:text-indigo-600 transition-colors font-medium"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-900 font-bold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;

