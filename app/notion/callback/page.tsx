'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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
          const exchangeRes = await fetch(`${API_BASE}/api/notion/callback`, {
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
        const statusRes = await fetch(`${API_BASE}/api/notion/status`, {
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500" />
            <p className="text-slate-300 text-lg">Connecting to Notion…</p>
            <p className="text-slate-500 text-sm">
              Completing the OAuth flow, this may take a moment.
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 mx-auto text-green-500" />
            <p className="text-green-400 text-lg font-medium">Notion connected!</p>
            <p className="text-slate-500 text-sm">
              Redirecting back to LearnMate…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 mx-auto text-red-500" />
            <p className="text-red-400 text-lg font-medium">Connection failed</p>
            <p className="text-slate-500 text-sm">{error}</p>
            <button
              onClick={() => router.replace('/')}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 transition-colors"
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500" />
          <p className="text-slate-300 text-lg">Connecting to Notion…</p>
          <p className="text-slate-500 text-sm">
            Completing the OAuth flow, this may take a moment.
          </p>
        </div>
      </div>
    }>
      <NotionCallbackInner />
    </Suspense>
  );
}