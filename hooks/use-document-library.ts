'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { uploadFile, getDocumentStatus } from '@/lib/api';

/** Terminal + transient states a library item can be in. */
export type LibraryDocState =
  | 'processing' // uploaded, indexing in the background
  | 'ready' // usable — the assistant can answer about it
  | 'failed' // backend reported indexing failed
  | 'timeout' // gave up polling after the cap
  | 'error'; // upload itself failed (network / rejected)

export interface LibraryDoc {
  /** Stable client-side id for React keys and updates. */
  id: string;
  /** Backend document id — only documents have one (needed to poll). */
  documentId?: string;
  filename: string;
  type: 'document' | 'image';
  state: LibraryDocState;
  chunkCount?: number;
  error?: string;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

/**
 * Manage a session's document library: upload files to the async `/upload`
 * endpoint and poll each document's status until it is ready (or fails / times
 * out). Images have nothing to index and land `ready` immediately.
 */
export function useDocumentLibrary(sessionId: string) {
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  // Active poll timers keyed by client id, so we can cancel on remove/unmount.
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  }, []);

  // Cancel every outstanding poll when the hook unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Documents are scoped to a single chat. When the user switches to a different
  // chat, drop the previous chat's list and stop its in-flight status polls. We
  // skip the initial "" → first-session transition on load so an upload made
  // right after mount isn't wiped when the session id resolves.
  const prevSessionRef = useRef(sessionId);
  useEffect(() => {
    const prev = prevSessionRef.current;
    if (prev === sessionId) return;
    prevSessionRef.current = sessionId;
    if (!prev) return; // first real session id after load — nothing to reset

    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    setDocs([]);
  }, [sessionId]);

  const patch = useCallback((id: string, changes: Partial<LibraryDoc>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));
  }, []);

  const pollStatus = useCallback(
    (id: string, documentId: string) => {
      const startedAt = Date.now();

      const tick = async () => {
        try {
          const s = await getDocumentStatus(documentId);
          if (s.status === 'ready') {
            patch(id, { state: 'ready', chunkCount: s.chunk_count });
            return;
          }
          if (s.status === 'failed') {
            patch(id, { state: 'failed', error: 'Indexing failed.' });
            return;
          }
        } catch {
          // Transient error — keep polling until the cap.
        }

        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          patch(id, { state: 'timeout', error: 'Timed out while processing.' });
          return;
        }
        timersRef.current[id] = setTimeout(tick, POLL_INTERVAL_MS);
      };

      tick();
    },
    [patch]
  );

  const uploadOne = useCallback(
    async (file: File) => {
      const id = uuidv4();
      // Optimistic entry — guess type from the MIME so the row shows instantly.
      const optimisticType: LibraryDoc['type'] = file.type.startsWith('image/')
        ? 'image'
        : 'document';
      setDocs((prev) => [
        { id, filename: file.name, type: optimisticType, state: 'processing' },
        ...prev,
      ]);

      try {
        const up = await uploadFile(sessionId, file);

        // Branch on the body, not the HTTP code. Images need no indexing.
        if (up.type !== 'document') {
          patch(id, { type: up.type, filename: up.filename, state: 'ready' });
          return;
        }

        if (!up.document_id) {
          patch(id, { state: 'error', error: 'Missing document id from server.' });
          return;
        }

        patch(id, {
          type: 'document',
          documentId: up.document_id,
          filename: up.filename,
          state: 'processing',
        });
        pollStatus(id, up.document_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        patch(id, { state: 'error', error: message });
      }
    },
    [sessionId, patch, pollStatus]
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        void uploadOne(file);
      });
    },
    [uploadOne]
  );

  const removeDoc = useCallback(
    (id: string) => {
      clearTimer(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    },
    [clearTimer]
  );

  return { docs, uploadFiles, removeDoc };
}
