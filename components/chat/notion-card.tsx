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
      className="block w-full px-4 py-3 rounded-lg border border-border/70 bg-surface-1/50 hover:bg-surface-2 hover:border-accent/45 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground/95 group-hover:text-accent transition-colors">
            {pageTitle}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {url}
          </p>
        </div>
        {/* Amber spark — the brand's warm accent, kept small on a teal card. */}
        <ExternalLink
          className="w-4 h-4 shrink-0"
          style={{ color: 'var(--accent-2)' }}
          aria-hidden="true"
        />
      </div>
    </a>
  );
}
