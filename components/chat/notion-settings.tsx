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

  return (
    <div className={`rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2 mb-3">
        {/* Notion logo mark */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEFEFE]/10 border border-[#FEFEFE]/20 shrink-0">
          <span className="text-[10px] font-bold text-[#FEFEFE] tracking-tight">N</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200">Notion</p>
          <p className="text-[11px] text-slate-500">Notes sync to your workspace</p>
        </div>

        {connected && (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 shrink-0">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-300">Connected</span>
          </div>
        )}
      </div>

      {connected ? (
        <div className="space-y-3">
          {workspaceName && (
            <p className="text-[12px] text-slate-400 truncate">
              Workspace: <span className="text-slate-300">{workspaceName}</span>
            </p>
          )}
          <button
            onClick={disconnect}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-slate-600/60 bg-slate-700/40 px-3 py-2 text-xs text-slate-300 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-300 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Unlink className="w-3 h-3" />
            )}
            {loading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] text-slate-400 leading-relaxed">
            Connect your Notion workspace so that structured learning notes are saved directly to your account using a
            public OAuth integration.
          </p>
          <button
            onClick={connect}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#FEFEFE] px-3 py-2 text-xs font-medium text-slate-900 hover:bg-[#E8E8E8] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ExternalLink className="w-3 h-3" />
            )}
            {loading ? 'Authorizing…' : 'Connect Notion'}
          </button>
        </div>
      )}
    </div>
  );
}
