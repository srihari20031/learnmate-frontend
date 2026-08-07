'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { BrandLogo } from '@/components/chat/brand-logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      // Clear token on failed login to avoid stale state
      sessionStorage.removeItem('access_token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandLogo className="mb-5 h-14 w-14 rounded-2xl shadow-[var(--elev-3)]" />
        <h1 className="font-display text-5xl text-gradient-brand mb-2">LearnMate</h1>
        <p className="text-muted-foreground text-base">
          Learn any technology through conversation.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass w-full max-w-sm space-y-4 rounded-2xl border border-border/70 p-8 shadow-[var(--elev-3)]"
      >
        <h2 className="text-lg font-semibold text-foreground mb-1">Welcome back</h2>
        <p className="text-sm text-muted-foreground -mt-1 mb-4">Sign in to continue.</p>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground/80">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground/80">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--elev-2)] transition hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--gradient-accent)' }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-1">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-accent font-medium hover:underline underline-offset-2">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
