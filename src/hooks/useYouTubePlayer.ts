import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { YouTubeTrack } from '../lib/config/types';
import { createPlaybackTimeStore } from '../lib/playback-time-store';
import {
  $activePlayerId,
  getStoredMode,
  getStoredVolume,
  type PlayMode,
  setStoredMode,
  setStoredVolume,
} from '../store/player';

export interface MediaPlayerState {
  playing: boolean;
  currentIndex: number;
  loading: boolean;
  error: string | null;
  mode: PlayMode;
  volume: number;
  muted: boolean;
}

// Global script loader to ensure API is only loaded once
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      window.onYouTubeIframeAPIReady = () => {
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    });
  }
  return ytApiPromise;
}

function getPlayerContainer(): HTMLDivElement {
  let container = document.getElementById('yt-player-mount') as HTMLDivElement;
  if (!container) {
    container = document.createElement('div');
    container.id = 'yt-player-mount';
    container.setAttribute('data-astro-transition-persist', 'yt-player-global');
    container.style.position = 'absolute';
    container.style.width = '200px';
    container.style.height = '200px';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';

    const mountPoint = document.createElement('div');
    mountPoint.id = 'yt-player-iframe';
    container.appendChild(mountPoint);

    document.body.appendChild(container);
  }
  return container;
}

// Global listeners for multiple hook instances
if (typeof window !== 'undefined' && !window.globalYtListeners) {
  window.globalYtListeners = new Set();
}

// Minimal type definitions for YouTube IFrame API
interface YTPlayerEvent {
  data: number;
  target: YTPlayerInstance;
}

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YTPlayerConstructor {
  new (elementId: string, config: Record<string, unknown>): YTPlayerInstance;
}

interface YTNamespace {
  Player: YTPlayerConstructor;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

type YTEventListener = (event: YTPlayerEvent, type: string) => void;

// Need to declare YT namespace for TypeScript
declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady: () => void;
    globalYtPlayer: YTPlayerInstance | null;
    globalYtListeners: Set<YTEventListener>;
  }
}

/** Pick a random index, excluding `exclude` to avoid repeats. */
function randomIndex(length: number, exclude: number): number {
  if (length <= 1) return 0;
  const candidates = length - 1;
  let pick = Math.floor(Math.random() * candidates);
  if (pick >= exclude) pick++;
  return pick;
}

export function useYouTubePlayer(tracks: YouTubeTrack[]) {
  const playerId = useId();

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const [timeStore] = useState(() => createPlaybackTimeStore());

  const [state, setState] = useState<MediaPlayerState>({
    playing: false,
    currentIndex: 0,
    loading: true,
    error: null,
    mode: getStoredMode(),
    volume: getStoredVolume(),
    muted: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const isReadyRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAndPlayRef = useRef<(index: number) => void>(() => {});

  // Create YouTube Player instance
  useEffect(() => {
    let unmounted = false;

    // Create local listener
    const handleYtEvent: YTEventListener = (event, type) => {
      // Only process events if this player is the active one,
      // EXCEPT onReady which everyone should know about.
      if (type !== 'onReady' && $activePlayerId.get() !== playerId) {
        // If we are not active, ensure our playing state is false
        if (stateRef.current.playing) {
          setState((s) => ({ ...s, playing: false }));
        }
        return;
      }

      if (type === 'onReady') {
        isReadyRef.current = true;
        setState((s) => ({ ...s, loading: false }));
      } else if (type === 'onStateChange') {
        const YTState = window.YT.PlayerState;
        switch (event.data) {
          case -1: // UNSTARTED
            break;
          case YTState.PLAYING:
            setState((s) => ({ ...s, playing: true, loading: false, error: null }));
            timeStore.setDuration(event.target.getDuration());
            break;
          case YTState.PAUSED:
            setState((s) => ({ ...s, playing: false }));
            break;
          case YTState.BUFFERING:
            setState((s) => ({ ...s, loading: true }));
            break;
          case YTState.ENDED: {
            const prev = stateRef.current;
            const currentTracks = tracksRef.current;
            if (currentTracks.length === 0) {
              setState((s) => ({ ...s, playing: false }));
              return;
            }
            let nextIndex: number;
            if (prev.mode === 'loop') {
              nextIndex = prev.currentIndex;
            } else if (prev.mode === 'random') {
              nextIndex = randomIndex(currentTracks.length, prev.currentIndex);
            } else {
              nextIndex = prev.currentIndex + 1 >= currentTracks.length ? 0 : prev.currentIndex + 1;
            }
            loadAndPlayRef.current(nextIndex);
            break;
          }
          case YTState.CUED:
            setState((s) => ({ ...s, loading: false }));
            break;
        }
      } else if (type === 'onError') {
        console.error('YouTube Player Error:', event.data);
        setState((s) => ({ ...s, playing: false, loading: false, error: 'Failed to load media' }));

        // Auto-skip on error if there are multiple tracks to prevent dead ends
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          if (unmounted) return;
          const currentTracks = tracksRef.current;
          if (currentTracks.length > 1) {
            const nextIndex = (stateRef.current.currentIndex + 1) % currentTracks.length;
            loadAndPlayRef.current(nextIndex);
          }
        }, 2000);
      }
    };

    window.globalYtListeners.add(handleYtEvent);

    loadYouTubeApi().then(() => {
      if (unmounted) return;
      getPlayerContainer(); // ensure container exists

      if (!window.globalYtPlayer) {
        window.globalYtPlayer = new window.YT.Player('yt-player-iframe', {
          height: '200',
          width: '200',
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
          },
          events: {
            onReady: (event: YTPlayerEvent) => {
              // Set initial volume and unmute
              const vol = getStoredVolume();
              event.target.setVolume(vol * 100);
              if (vol > 0) {
                event.target.unMute();
              }
              window.globalYtListeners.forEach((l) => {
                l(event, 'onReady');
              });
            },
            onStateChange: (event: YTPlayerEvent) => {
              window.globalYtListeners.forEach((l) => {
                l(event, 'onStateChange');
              });
            },
            onError: (event: YTPlayerEvent) => {
              window.globalYtListeners.forEach((l) => {
                l(event, 'onError');
              });
            },
          },
        });
      }

      ytPlayerRef.current = window.globalYtPlayer;

      if (ytPlayerRef.current?.getPlayerState) {
        isReadyRef.current = true;
        setState((s) => ({ ...s, loading: false }));
      }
    });

    return () => {
      unmounted = true;
      window.globalYtListeners.delete(handleYtEvent);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [playerId, timeStore]);

  // Sync playback time to store via interval (~4 updates/s, matching YT API resolution)
  useEffect(() => {
    if (!state.playing) return;

    const id = setInterval(() => {
      if (ytPlayerRef.current?.getCurrentTime) {
        timeStore.setCurrentTime(ytPlayerRef.current.getCurrentTime());
      }
    }, 250);

    return () => clearInterval(id);
  }, [state.playing, timeStore]);

  const loadAndPlay = useCallback(
    (index: number) => {
      const currentTracks = tracksRef.current;
      if (!isReadyRef.current || !ytPlayerRef.current || !currentTracks[index]) return;

      const track = currentTracks[index];
      ytPlayerRef.current.loadVideoById(track.youtubeId);
      if (stateRef.current.volume > 0 && !stateRef.current.muted) {
        ytPlayerRef.current.unMute();
      }
      $activePlayerId.set(playerId);
      timeStore.reset();
      setState((s) => ({ ...s, currentIndex: index, loading: true, error: null, playing: true }));
    },
    [playerId, timeStore],
  );
  loadAndPlayRef.current = loadAndPlay;

  // Pause when another player starts (imperative subscription, no re-renders)
  useEffect(() => {
    return $activePlayerId.subscribe((id) => {
      if (id !== null && id !== playerId && stateRef.current.playing) {
        ytPlayerRef.current?.pauseVideo?.();
      }
    });
  }, [playerId]);

  const play = useCallback(
    (index?: number) => {
      if (!isReadyRef.current || !ytPlayerRef.current || tracksRef.current.length === 0) return;
      const targetIndex = index ?? state.currentIndex;

      const isActive = $activePlayerId.get() === playerId;

      // Check if we need to load a new track
      if (index != null || !isActive) {
        loadAndPlay(targetIndex);
      } else {
        // Just resume current
        ytPlayerRef.current.playVideo();
        $activePlayerId.set(playerId);
      }
    },
    [state.currentIndex, loadAndPlay, playerId],
  );

  const pause = useCallback(() => {
    if (isReadyRef.current && ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (state.playing) pause();
    else play();
  }, [state.playing, pause, play]);

  const nextTrack = useCallback(() => {
    const currentTracks = tracksRef.current;
    if (currentTracks.length === 0) return;
    let next: number;
    if (state.mode === 'random') {
      next = randomIndex(currentTracks.length, state.currentIndex);
    } else {
      next = (state.currentIndex + 1) % currentTracks.length;
    }
    loadAndPlay(next);
  }, [state.mode, state.currentIndex, loadAndPlay]);

  const prevTrack = useCallback(() => {
    const currentTracks = tracksRef.current;
    if (currentTracks.length === 0) return;
    let prev: number;
    if (state.mode === 'random') {
      prev = randomIndex(currentTracks.length, state.currentIndex);
    } else {
      prev = state.currentIndex - 1 < 0 ? currentTracks.length - 1 : state.currentIndex - 1;
    }
    loadAndPlay(prev);
  }, [state.mode, state.currentIndex, loadAndPlay]);

  const seek = useCallback(
    (time: number) => {
      if (isReadyRef.current && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
        ytPlayerRef.current.seekTo(time, true);
        timeStore.setCurrentTime(time);
      }
    },
    [timeStore],
  );

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    if (isReadyRef.current && ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      ytPlayerRef.current.setVolume(clamped * 100);
      if (clamped > 0 && stateRef.current.muted) {
        ytPlayerRef.current.unMute();
      }
    }
    setStoredVolume(clamped);
    setState((s) => ({ ...s, volume: clamped, muted: clamped === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    const newMuted = !state.muted;
    if (newMuted) {
      ytPlayerRef.current.mute();
    } else {
      ytPlayerRef.current.unMute();
    }
    setState((s) => ({ ...s, muted: newMuted }));
  }, [state.muted]);

  const setMode = useCallback((mode: PlayMode) => {
    setStoredMode(mode);
    setState((s) => ({ ...s, mode }));
  }, []);

  return {
    state,
    timeStore,
    play,
    pause,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    setMode,
  };
}
