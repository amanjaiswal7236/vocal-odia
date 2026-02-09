'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DocumentState, SavedDocument } from '@/types';
import VoiceInputPanel from './VoiceInputPanel';

interface DocumentEditorProps {
  document: DocumentState;
  currentId: string | null;
  historyLength: number;
  autoSaveStatus: 'saved' | 'saving' | 'unsaved' | null;
  onDocumentUpdate: (doc: DocumentState) => void;
  onUndo: () => boolean;
  onSave: () => void;
  onNew: () => void;
  onBackToList: () => void;
  onLoadDocuments: () => Promise<void>;
  documents: SavedDocument[];
  onOpenDocument: (doc: SavedDocument) => void;
}

export default function DocumentEditor({
  document: doc,
  currentId,
  historyLength,
  autoSaveStatus,
  onDocumentUpdate,
  onUndo,
  onSave,
  onNew,
  onBackToList,
  onLoadDocuments,
  documents,
  onOpenDocument,
}: DocumentEditorProps) {
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [bodyValue, setBodyValue] = useState(doc.paragraphs.join('\n\n'));
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setBodyValue(doc.paragraphs.join('\n\n'));
  }, [doc.paragraphs]);

  const syncBodyToDoc = useCallback(() => {
    const paragraphs = bodyValue
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length === 0 && bodyValue.trim() === '') {
      onDocumentUpdate({ ...doc, paragraphs: [] });
    } else if (paragraphs.length > 0) {
      onDocumentUpdate({ ...doc, paragraphs });
    }
  }, [bodyValue, doc, onDocumentUpdate]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value || 'Untitled Document';
    onDocumentUpdate({ ...doc, title });
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBodyValue(e.target.value);
    const paragraphs = e.target.value
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length === 0 && e.target.value.trim() === '') {
      onDocumentUpdate({ ...doc, paragraphs: [] });
    } else {
      onDocumentUpdate({ ...doc, paragraphs: paragraphs.length ? paragraphs : [e.target.value] });
    }
  };

  const handleExport = useCallback(() => {
    const text = [doc.title, '', ...doc.paragraphs].join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(doc.title || 'Untitled').replace(/[^a-z0-9.-]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doc]);

  const statusLabel =
    autoSaveStatus === 'saving'
      ? 'Saving…'
      : autoSaveStatus === 'saved'
        ? 'Saved'
        : autoSaveStatus === 'unsaved'
          ? 'Unsaved'
          : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Toolbar — Google Docs style */}
      <div className="flex items-center gap-2 py-2 px-3 border-b border-gray-200 bg-white rounded-t-xl shrink-0">
        <button
          type="button"
          onClick={onBackToList}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          title="Back to documents"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <button
          type="button"
          onClick={onNew}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          title="New document"
        >
          <i className="fas fa-plus"></i>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowOpenMenu((v) => !v); if (!showOpenMenu) onLoadDocuments(); }}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 flex items-center gap-1"
            title="Open document"
          >
            <i className="fas fa-folder-open"></i>
            <i className="fas fa-caret-down text-xs"></i>
          </button>
          {showOpenMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowOpenMenu(false)} />
              <div className="absolute left-0 top-full mt-1 w-72 max-h-80 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                {documents.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500">No documents</div>
                ) : (
                  documents.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        onOpenDocument(d);
                        setShowOpenMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm truncate"
                    >
                      {d.title || 'Untitled Document'}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onSave}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          title="Save"
        >
          <i className="fas fa-save"></i>
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          title="Export as .txt"
        >
          <i className="fas fa-download"></i>
        </button>

        {/* Small voice input icon */}
        <button
          type="button"
          onClick={() => setShowVoicePanel((v) => !v)}
          className={`p-2 rounded-lg transition-colors ${
            showVoicePanel ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Voice input"
        >
          <i className="fas fa-microphone"></i>
        </button>

        {statusLabel && (
          <span className="ml-2 text-xs text-gray-500 tabular-nums">{statusLabel}</span>
        )}
      </div>

      {/* Document area */}
      <div className="flex-1 flex flex-col min-h-0 bg-white border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-hidden">
        <input
          type="text"
          value={doc.title}
          onChange={handleTitleChange}
          placeholder="Untitled Document"
          className="w-full px-6 pt-6 pb-2 text-2xl font-medium text-gray-900 placeholder-gray-400 border-0 focus:outline-none focus:ring-0"
        />
        <textarea
          ref={bodyRef}
          value={bodyValue}
          onChange={handleBodyChange}
          onBlur={syncBodyToDoc}
          placeholder="Start writing or use the voice icon to dictate…"
          className="flex-1 w-full px-6 pb-6 pt-2 text-gray-800 resize-none focus:outline-none focus:ring-0 border-0 leading-relaxed"
          style={{ minHeight: 240 }}
        />
      </div>

      {/* Voice panel — compact popover */}
      {showVoicePanel && (
        <VoiceInputPanel
          document={doc}
          onDocumentUpdate={onDocumentUpdate}
          onUndo={onUndo}
          hasHistory={historyLength > 0}
          onSave={onSave}
          onClose={() => setShowVoicePanel(false)}
        />
      )}
    </div>
  );
}
