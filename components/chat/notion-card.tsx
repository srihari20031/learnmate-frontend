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
      className="block w-full px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/50 transition-all duration-300 group hover:shadow-lg hover:shadow-amber-500/10"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
            {getPageTitle(url)}
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
