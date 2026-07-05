'use client';

import { ExternalLink } from 'lucide-react';

interface NotionCardProps {
  url: string;
  /** Authoritative topic title from the backend, if available. */
  title?: string;
}

/**
 * Derive a human-readable topic from a Notion URL slug.
 * Notion pages are addressed as `.../My-Topic-Title-<32 hex chars>`, so we take
 * the last path segment, drop the trailing page id, and turn dashes into spaces.
 */
function titleFromUrl(urlString: string): string {
  try {
    const { pathname } = new URL(urlString);
    const segment = pathname.split('/').filter(Boolean).pop() ?? '';
    const slug = segment.replace(/-?[0-9a-f]{32}$/i, '');
    const title = decodeURIComponent(slug || segment).replace(/-/g, ' ').trim();
    return title.length > 0 ? title : 'Notion Page';
  } catch {
    return 'Notion Page';
  }
}

export function NotionCard({ url, title }: NotionCardProps) {
  const pageTitle = title?.trim() || titleFromUrl(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/50 transition-all duration-300 group hover:shadow-lg hover:shadow-amber-500/10"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
            {pageTitle}
          </p>
          <p className="text-xs text-amber-400/60 truncate">
            {url}
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-amber-400 flex-shrink-0 group-hover:text-amber-300 transition-colors" />
      </div>
    </a>
  );
}
