'use client';

import React from 'react';
import { SavedDocument } from '@/types';

interface DocumentsListProps {
  documents: SavedDocument[];
  onNew: () => void;
  onOpen: (doc: SavedDocument) => void;
  onDelete: (id: string) => void;
}

export default function DocumentsList({ documents, onNew, onOpen, onDelete }: DocumentsListProps) {
  const formatDate = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
        >
          <i className="fas fa-plus"></i>
          New document
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <i className="fas fa-file-alt text-4xl mb-4 text-gray-300"></i>
            <p className="font-medium">No documents yet</p>
            <p className="text-sm mt-1">Create one to start practicing with voice or typing.</p>
            <button
              onClick={onNew}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <i className="fas fa-plus"></i>
              New document
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <button
                  onClick={() => onOpen(doc)}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="font-medium text-gray-900 truncate block">{doc.title}</span>
                  <span className="text-sm text-gray-500">
                    {formatDate(doc.updatedAt)} · {doc.paragraphs.length} paragraph{doc.paragraphs.length !== 1 ? 's' : ''}
                  </span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpen(doc)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                    title="Open"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${doc.title}"?`)) onDelete(doc.id);
                    }}
                    className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
