/**
 * Consumer hooks for PlaybackTimeStore.
 *
 * - `usePlaybackProgress` — imperative DOM updates for progress bars (zero re-renders)
 * - `usePlaybackFormattedTime` — discrete sync for time text (max 1 re-render/s)
 */

import { formatTime } from '@components/markdown/audio-player/utils';
import type { PlaybackTimeStore } from '@lib/playback-time-store';
import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Imperatively updates a progress bar element's width via ref.
 * No React re-renders — purely DOM-driven.
 */
export function usePlaybackProgress(
  timeStore: PlaybackTimeStore,
  progressBarRef: RefObject<HTMLElement | null>,
  sliderRef?: RefObject<HTMLElement | null>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref.current is accessed imperatively, refs are stable identity objects
  useEffect(() => {
    const sync = () => {
      const bar = progressBarRef.current;
      if (bar) {
        bar.style.width = `${timeStore.getProgress()}%`;
      }
      const slider = sliderRef?.current;
      if (slider) {
        slider.setAttribute('aria-valuenow', String(Math.floor(timeStore.getCurrentTime())));
        slider.setAttribute('aria-valuemax', String(Math.floor(timeStore.getDuration())));
      }
    };
    sync();
    return timeStore.subscribe(sync);
  }, [timeStore]);
}

/**
 * Returns a formatted time string "01:23 / 04:56" via useSyncExternalStore.
 * Only triggers re-render when the displayed second changes (max 1/s).
 */
export function usePlaybackFormattedTime(timeStore: PlaybackTimeStore): string {
  const cachedRef = useRef('00:00 / 00:00');
  const prevSecsRef = useRef(-1);
  const prevDurSecsRef = useRef(-1);

  return useSyncExternalStore(
    timeStore.subscribe,
    () => {
      const curSecs = Math.floor(timeStore.getCurrentTime());
      const durSecs = Math.floor(timeStore.getDuration());
      if (curSecs !== prevSecsRef.current || durSecs !== prevDurSecsRef.current) {
        prevSecsRef.current = curSecs;
        prevDurSecsRef.current = durSecs;
        cachedRef.current = `${formatTime(timeStore.getCurrentTime())} / ${formatTime(timeStore.getDuration())}`;
      }
      return cachedRef.current;
    },
    () => '00:00 / 00:00',
  );
}
