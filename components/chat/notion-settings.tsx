'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Unlink, ExternalLink, Loader2 } from 'lucide-react';
import { authHeaders, getNotionConnectUrl, getNotionStatus, disconnectNotion } from '@/lib/api';

export function useNotionStatus() {
  const [connected, setConnected] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await getNotionStatus();
      setConnected(data.connected);
      setWorkspaceName(data.workspace_name);
      return data.connected;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 10 s so the UI stays fresh after an external disconnect.
    pollTimerRef.current = setInterval(fetchStatus, 10000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const connect = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const { authorization_url } = await getNotionConnectUrl();

      if (!authorization_url) {
        throw new Error('No authorization_url received from backend');
      }

      window.location.href = authorization_url;
      return true;
    } catch (err) {
      console.error('Notion connect error:', err);
      setLoading(false);
      return false;
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await disconnectNotion();
      setConnected(false);
      setWorkspaceName(undefined);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return { connected, workspaceName, loading, connect, disconnect, refresh: fetchStatus };
}

interface NotionSettingsProps {
  className?: string;
}

/**
 * Compact Notion connection widget — suitable for embedding in a sidebar or
 * a settings drawer.  Shows a green badge + workspace name when connected,
 * and a "Connect Notion" / "Disconnect" button otherwise.
 */
export function NotionSettings({ className }: NotionSettingsProps) {
  const { connected, workspaceName, loading, connect, disconnect } = useNotionStatus();

  // Connected — slim status row; disconnect tucked behind a hover icon button.
  if (connected) {
    return (
      <div
        className={`group flex items-center gap-2.5 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2 ${className ?? ''}`}
        title={workspaceName ? `Workspace: ${workspaceName}` : 'Notion connected'}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 border border-white/20 shrink-0">
          <span className="text-[9px] font-bold text-white">N</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-tight truncate">
            {workspaceName || 'Notion'}
          </p>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle className="w-2.5 h-2.5" /> Connected
          </span>
        </div>
        <button
          onClick={disconnect}
          disabled={loading}
          aria-label="Disconnect Notion"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  // Not connected — single slim action row.
  return (
    <button
      onClick={connect}
      disabled={loading}
      className={`flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2 text-left hover:border-border-strong hover:bg-surface-2 transition-colors disabled:opacity-50 ${className ?? ''}`}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 border border-white/20 shrink-0">
        <span className="text-[9px] font-bold text-white">N</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground leading-tight">Connect Notion</p>
        <p className="text-[10px] text-muted-foreground leading-tight">Sync notes to your workspace</p>
      </div>
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}
