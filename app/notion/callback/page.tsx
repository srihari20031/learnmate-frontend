'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

import { apiBase } from '@/lib/api';

function getAuthHeaders(): Record<string, string> {
  try {
    const token = typeof window !== 'undefined'
      ? sessionStorage.getItem('access_token') ?? ''
      : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function NotionCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (!code) {
      setStatus('error');
      setError('Missing authorization code.');
      return;
    }

    let cancelled = false;
    const pollInterval = 2000;
    const maxAttempts = 30;
    let attempts = 0;
    let exchangeDone = false;

    const poll = async () => {
      attempts++;

      if (!exchangeDone) {
        exchangeDone = true;
        try {
          const exchangeRes = await fetch(`${apiBase()}/api/notion/callback`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          });
          const exchangeText = await exchangeRes.text();
          console.log('[Notion] Exchange response:', exchangeRes.status, exchangeText);
        } catch (err) {
          console.error('Notion callback exchange failed:', err);
        }
      }

      try {
        const statusRes = await fetch(`${apiBase()}/api/notion/status`, {
          headers: getAuthHeaders(),
        });
        const statusText = await statusRes.text();
        console.log('[Notion] Status response:', statusRes.status, statusText);
        if (!cancelled && statusRes.ok) {
          const data: { connected: boolean } = JSON.parse(statusText);
          if (data.connected) {
            setStatus('success');
            setTimeout(() => router.replace('/'), 1500);
            return;
          }
        }
      } catch (err) {
        console.error('[Notion] Status poll failed:', err);
      }

      if (!cancelled && attempts < maxAttempts) {
        setTimeout(poll, pollInterval);
      } else if (!cancelled) {
        setStatus('error');
        setError('Connection timed out. Please try again from the main page.');
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass w-full max-w-sm space-y-5 text-center rounded-2xl border border-border/70 p-8 shadow-[var(--elev-3)]">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent" />
            <p className="text-foreground text-lg">Connecting to Notion…</p>
            <p className="text-muted-foreground text-sm">
              Completing the OAuth flow, this may take a moment.
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="text-emerald-400 text-lg font-medium">Notion connected!</p>
            <p className="text-muted-foreground text-sm">
              Redirecting back to LearnMate…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 mx-auto text-red-500" />
            <p className="text-red-400 text-lg font-medium">Connection failed</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={() => router.replace('/')}
              className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-accent-foreground shadow-[var(--elev-2)] hover:opacity-90 transition"
              style={{ background: 'var(--gradient-accent)' }}
            >
              Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NotionCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent" />
          <p className="text-foreground text-lg">Connecting to Notion…</p>
          <p className="text-muted-foreground text-sm">
            Completing the OAuth flow, this may take a moment.
          </p>
        </div>
      </div>
    }>
      <NotionCallbackInner />
    </Suspense>
  );
}