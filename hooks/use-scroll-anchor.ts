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
    // Scroll ONLY the messages container. Using messagesEndRef.scrollIntoView()
    // walks up and scrolls every ancestor scroll box — including the outer
    // overflow-hidden columns that hold the header — which pushes the header
    // off-screen with no way for the user to scroll it back. Setting scrollTop
    // on the container itself keeps the scroll strictly inside the thread.
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
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
