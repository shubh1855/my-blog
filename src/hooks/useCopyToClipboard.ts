/**
 * Hook for clipboard copy with visual feedback state.
 * Encapsulates the copy-to-clipboard logic and manages the "copied" state timer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const FEEDBACK_DURATION = 2000;

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);

  // Clear pending timeout on unmount to prevent setState on unmounted component
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(async (text: string) => {
    const attempt = ++attemptRef.current;
    setCopied(false);
    setFailed(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
    } catch {
      if (mountedRef.current && attempt === attemptRef.current) setFailed(true);
      return;
    }

    if (!mountedRef.current || attempt !== attemptRef.current) return;
    setCopied(true);
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setCopied(false);
    }, FEEDBACK_DURATION);
  }, []);

  return { copied, failed, copy };
}
