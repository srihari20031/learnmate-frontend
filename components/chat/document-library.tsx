'use client';

import { useRef, useState, ChangeEvent } from 'react';
import {
  Plus,
  FileText,
  Image as ImageIcon,
  Loader2,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useDocumentLibrary, LibraryDoc } from '@/hooks/use-document-library';

interface DocumentLibraryProps {
  /** Active session id — sent as the `session-id` header on upload. */
  sessionId: string;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/webp',
];

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

/** Small status line rendered on the right of each library row. */
function DocStatus({ doc }: { doc: LibraryDoc }) {
  switch (doc.state) {
    case 'processing':
      return (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Processing…
        </span>
      );
    case 'ready':
      return (
        <span className="flex items-center gap-1 text-[11px] text-emerald-400">
          <Check className="h-3 w-3" aria-hidden="true" />
          {doc.type === 'image' ? 'Uploaded' : 'Ready'}
        </span>
      );
    case 'failed':
    case 'timeout':
      return (
        <span className="flex items-center gap-1 text-[11px] text-amber-400">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {doc.state === 'timeout' ? 'Timed out' : 'Failed'}
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[11px] text-red-400">
          <X className="h-3 w-3" aria-hidden="true" />
          Upload failed
        </span>
      );
  }
}

/**
 * The row's remove control. For an indexed document this is destructive and
 * irreversible (the chunks are purged from the vector store), so it is gated
 * behind a confirmation. Images were never indexed — removing them is just a
 * UI action, so they delete straight away.
 */
function RemoveButton({ doc, onRemove }: { doc: LibraryDoc; onRemove: () => void }) {
  const isIndexed = !!doc.documentId;

  const button = (
    <button
      type="button"
      disabled={doc.deleting}
      aria-label={`Remove ${doc.filename}`}
      onClick={isIndexed ? undefined : onRemove}
      className={`shrink-0 rounded p-0.5 text-muted-foreground transition-opacity hover:text-red-400 disabled:cursor-not-allowed ${
        doc.deleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
    >
      {doc.deleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );

  if (!isIndexed) return button;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove &ldquo;{doc.filename}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently un-indexes the document — the assistant will no longer be
            able to cite it in any answer. To restore it you would have to upload it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRemove}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DocumentLibrary({ sessionId }: DocumentLibraryProps) {
  const { docs, uploadFiles, removeDoc } = useDocumentLibrary(sessionId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;
    setError(null);

    const badType = files.find((f) => !ALLOWED_TYPES.includes(f.type));
    if (badType) {
      setError('Unsupported file type. Allowed: PDF, DOCX, DOC, TXT, and images.');
      return;
    }
    if (files.some((f) => f.size > MAX_SIZE)) {
      setError('One or more files exceed the 20 MB limit.');
      return;
    }

    uploadFiles(files);
  };

  // Delete failures keep the row in place; surface why in the inline alert.
  const handleRemove = async (doc: LibraryDoc) => {
    setError(null);
    try {
      await removeDoc(doc.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not delete ${doc.filename}.`);
    }
  };

  return (
    <div>
      <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
        Chat documents
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={!sessionId}
        aria-label="Add to this chat"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Add to this chat
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,image/*"
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />

      {error && (
        <p className="mt-1.5 px-1 text-[11px] text-red-400" role="alert">
          {error}
        </p>
      )}

      {docs.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-0.5">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2/50"
            >
              {doc.type === 'image' ? (
                <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-foreground/90" title={doc.filename}>
                  {doc.filename}
                </p>
                <DocStatus doc={doc} />
              </div>
              <RemoveButton doc={doc} onRemove={() => void handleRemove(doc)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
