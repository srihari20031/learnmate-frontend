import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

export interface UseScrollAnchorReturn {
  messagesEndRef: RefObject<HTMLDivElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isScrolledUp: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function useScrollAnchor(): UseScrollAnchorReturn {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsScrolledUp(distanceFromBottom > 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount to set initial state
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return {
    messagesEndRef,
    containerRef,
    isScrolledUp,
    scrollToBottom,
  };
}
