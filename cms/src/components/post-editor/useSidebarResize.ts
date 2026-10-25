import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useState } from 'react';

const SIDEBAR_WIDTH_KEY = 'cms-sidebar-width';
export const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_DEFAULT_WIDTH = 320;
export const SIDEBAR_MAX_WIDTH = 640;
const SIDEBAR_KEYBOARD_STEP = 16;

export function getSidebarMaxWidth(): number {
  // Preserve at least 320px for the editor canvas, including the resize handle.
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - 324));
}

function clampSidebarWidth(width: number): number {
  return Math.min(getSidebarMaxWidth(), Math.max(SIDEBAR_MIN_WIDTH, width));
}

export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const savedWidth = saved ? Number(saved) : SIDEBAR_DEFAULT_WIDTH;
    return Number.isFinite(savedWidth) ? clampSidebarWidth(savedWidth) : SIDEBAR_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const clampToViewport = () => setSidebarWidth((width) => clampSidebarWidth(width));
    window.addEventListener('resize', clampToViewport);
    clampToViewport();
    return () => window.removeEventListener('resize', clampToViewport);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(window.innerWidth - event.clientX));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, sidebarWidth]);

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLHRElement>) => {
      let nextWidth: number | null = null;

      if (event.key === 'ArrowLeft') nextWidth = sidebarWidth + SIDEBAR_KEYBOARD_STEP;
      if (event.key === 'ArrowRight') nextWidth = sidebarWidth - SIDEBAR_KEYBOARD_STEP;
      if (event.key === 'Home') nextWidth = SIDEBAR_MIN_WIDTH;
      if (event.key === 'End') nextWidth = getSidebarMaxWidth();
      if (nextWidth === null) return;

      event.preventDefault();
      const clampedWidth = clampSidebarWidth(nextWidth);
      setSidebarWidth(clampedWidth);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampedWidth));
    },
    [sidebarWidth],
  );

  const startResizing = useCallback(() => setIsResizing(true), []);

  return { sidebarWidth, isResizing, startResizing, handleResizeKeyDown };
}
