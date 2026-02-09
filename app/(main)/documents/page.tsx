'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/services/authService';
import { contentService } from '@/lib/services/contentService';
import { DocumentState, SavedDocument } from '@/types';
import DocumentEditor from '@/components/DocumentEditor';
import DocumentsList from '@/components/DocumentsList';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/components/Toast';

function getNewDocumentTitle(): string {
  const d = new Date();
  const when = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `Untitled Document (${when})`;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<DocumentState>(() => ({ title: getNewDocumentTitle(), paragraphs: [] }));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [history, setHistory] = useState<DocumentState[]>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/signin');
      return;
    }
    loadDocuments();
  }, [router]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const list = await contentService.getDocuments();
      setDocuments(Array.isArray(list) ? list.map(normalizeDoc) : []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeDoc = (row: Record<string, unknown>): SavedDocument => ({
    id: String(row.id),
    title: (row.title as string) || 'Untitled Document',
    paragraphs: Array.isArray(row.paragraphs) ? (row.paragraphs as string[]) : [],
    createdAt: (row.createdAt as string) || (row.created_at as string) || '',
    updatedAt: (row.updatedAt as string) || (row.updated_at as string) || '',
  });

  const handleNewDocument = useCallback(() => {
    setDocument({ title: getNewDocumentTitle(), paragraphs: [] });
    setCurrentId(null);
    setHistory([]);
    setAutoSaveStatus(null);
    lastSavedRef.current = '';
    setView('editor');
  }, []);

  const handleOpenDocument = useCallback((doc: SavedDocument) => {
    setDocument({ title: doc.title, paragraphs: doc.paragraphs });
    setCurrentId(doc.id);
    setHistory([]);
    setAutoSaveStatus('saved');
    lastSavedRef.current = JSON.stringify({ title: doc.title, paragraphs: doc.paragraphs });
    setView('editor');
  }, []);

  const handleDocumentUpdate = useCallback((newDoc: DocumentState) => {
    setHistory((prev) => {
      const next = [...prev, document];
      return next.length > 50 ? next.slice(1) : next;
    });
    setDocument(newDoc);
    setAutoSaveStatus('unsaved');
    const idToUse = currentId;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      autoSaveTimeoutRef.current = null;
      const key = JSON.stringify(newDoc);
      if (key === lastSavedRef.current) return;
      setAutoSaveStatus('saving');
      try {
        if (idToUse) {
          await contentService.updateDocument(idToUse, newDoc);
        } else {
          const created = await contentService.createDocument(newDoc);
          setCurrentId(created.id);
          await loadDocuments();
        }
        lastSavedRef.current = key;
        setAutoSaveStatus('saved');
      } catch {
        setAutoSaveStatus('unsaved');
        showToast('Auto-save failed', 'error');
      }
    }, 2000);
  }, [document, currentId, showToast]);

  const handleSave = useCallback(async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    setAutoSaveStatus('saving');
    try {
      if (currentId) {
        await contentService.updateDocument(currentId, document);
      } else {
        const created = await contentService.createDocument(document);
        setCurrentId(created.id);
        await loadDocuments();
      }
      lastSavedRef.current = JSON.stringify(document);
      setAutoSaveStatus('saved');
      showToast('Document saved', 'success');
    } catch {
      setAutoSaveStatus('unsaved');
      showToast('Failed to save document', 'error');
    }
  }, [document, currentId, showToast]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return false;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setDocument(prev);
    setAutoSaveStatus('unsaved');
    return true;
  }, [history]);

  const handleBackToList = useCallback(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    setView('list');
    loadDocuments();
  }, []);

  const handleDeleteDocument = useCallback(async (id: string) => {
    try {
      await contentService.deleteDocument(id);
      if (currentId === id) {
        setDocument({ title: getNewDocumentTitle(), paragraphs: [] });
        setCurrentId(null);
        setView('list');
      }
      await loadDocuments();
      showToast('Document deleted', 'info');
    } catch {
      showToast('Failed to delete document', 'error');
    }
  }, [currentId, showToast]);

  if (loading && documents.length === 0) {
    return <LoadingSpinner fullScreen text="Loading documents..." />;
  }

  if (view === 'list') {
    return (
      <div className="max-w-3xl mx-auto">
        <DocumentsList
          documents={documents}
          onNew={handleNewDocument}
          onOpen={handleOpenDocument}
          onDelete={handleDeleteDocument}
        />
      </div>
    );
  }

  return (
    <DocumentEditor
      document={document}
      currentId={currentId}
      historyLength={history.length}
      autoSaveStatus={autoSaveStatus}
      onDocumentUpdate={handleDocumentUpdate}
      onUndo={handleUndo}
      onSave={handleSave}
      onNew={handleNewDocument}
      onBackToList={handleBackToList}
      onLoadDocuments={loadDocuments}
      documents={documents}
      onOpenDocument={handleOpenDocument}
    />
  );
}
