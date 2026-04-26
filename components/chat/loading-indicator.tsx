'use client';

export function LoadingIndicator() {
  return (
    <div className="flex gap-2 py-2">
      <div className="w-2 h-2 bg-gradient-to-r from-blue-300 to-blue-400 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-gradient-to-r from-purple-300 to-purple-400 rounded-full animate-bounce shadow-lg shadow-purple-500/50" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-gradient-to-r from-blue-300 to-blue-400 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '300ms' }} />
    </div>
  );
}
