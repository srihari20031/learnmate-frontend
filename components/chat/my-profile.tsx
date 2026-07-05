'use client';

import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { UserRound, Loader2, Upload, Trash2, FileText, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  getProfile,
  uploadResume,
  clearProfile,
  ProfileResponse,
} from '@/lib/api';

// Résumé is a document only — no images (unlike the chat-document uploader).
const RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function stackChips(knownStack: string) {
  return knownStack
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MyProfile() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await getProfile());
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasStack = !!profile?.known_stack;

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setError(null);

    if (!RESUME_TYPES.includes(file.type)) {
      setError('Unsupported file type. Upload a PDF, DOCX, or TXT.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File exceeds the 20 MB limit.');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadResume(file);
      setProfile({
        known_stack: result.known_stack,
        resume_filename: result.resume_filename,
        updated_at: result.updated_at,
      });
    } catch (err) {
      // The backend detail (e.g. "That doesn't look like a résumé") is surfaced.
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setClearing(true);
    try {
      await clearProfile();
      setProfile({ known_stack: null, resume_filename: null, updated_at: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear profile.');
    } finally {
      setClearing(false);
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  return (
    <>
      {/* Sidebar trigger — account-level, distinct from per-chat documents */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="My Profile"
        className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-tight text-foreground">My Profile</p>
          <p className="truncate text-[10px] leading-tight text-muted-foreground">
            {loading
              ? 'Loading…'
              : hasStack
                ? 'Your stack · all chats'
                : 'Add your résumé · all chats'}
          </p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border/70 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-accent" aria-hidden="true" />
              My Profile
            </DialogTitle>
            <DialogDescription>
              This is who you are — your résumé sets the tech you already know, and it
              applies to <span className="font-medium text-foreground/80">every chat</span>.
              (For reference material about one conversation, use “Add to this chat”.)
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
            </div>
          ) : uploading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Analyzing your résumé…</p>
            </div>
          ) : hasStack ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your known stack
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {stackChips(profile!.known_stack!).map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {profile!.resume_filename && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-xs text-foreground/90">
                    {profile!.resume_filename}
                  </span>
                </div>
              )}

              {error && <p className="text-xs text-red-400" role="alert">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={pickFile}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground/90 transition-colors hover:bg-surface-2"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Update résumé
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={clearing}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  {clearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={pickFile}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-surface-2/30 px-4 py-8 text-center transition-colors hover:border-accent/50 hover:bg-surface-2/60"
              >
                <Upload className="h-6 w-6 text-accent" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">Upload résumé</span>
                <span className="text-xs text-muted-foreground">PDF, DOCX, or TXT · max 20 MB</span>
              </button>
              {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
