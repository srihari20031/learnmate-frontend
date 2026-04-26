'use client';

import { ExternalLink } from 'lucide-react';

interface NotionCardProps {
  url: string;
}

export function NotionCard({ url }: NotionCardProps) {
  const getPageTitle = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString);
      const hashPart = urlObj.hash;
      if (hashPart) {
        const pageId = hashPart.replace('#', '').split('?')[0];
        return pageId.length > 0 ? `Notion Page (${pageId.substring(0, 8)}...)` : 'Notion Page';
      }
      return 'Notion Page';
    } catch {
      return 'Notion Page';
    }
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 px-4 py-3 bg-accent/10 border border-accent/30 rounded-lg hover:bg-accent/20 hover:border-accent/50 transition-colors group"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
          {getPageTitle(url)}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {url}
        </p>
      </div>
      <ExternalLink className="w-4 h-4 text-accent flex-shrink-0" />
    </a>
  );
}
