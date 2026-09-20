import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { YouTubeTrack } from '../lib/config/types';
import { createPlaybackTimeStore } from '../lib/playback-time-store';
import {
  ensurePlayer,
  getPlayer,
  isIframeAlive,
  isPlayerReady,
  subscribe as subscribeToManager,
  type YTEventListener,
} from '../lib/yt-player-manager';
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

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAndPlayRef = useRef<(index: number) => void>(() => {});

  // Subscribe to manager events and ensure the player exists
  useEffect(() => {
    let unmounted = false;

    const handleEvent: YTEventListener = (event, type) => {
      // ── Rebuilding: all instances should show loading ──
      if (type === 'rebuilding') {
        setState((s) => ({ ...s, loading: true }));
        return;
      }

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
        setState((s) => ({ ...s, loading: false }));
      } else if (type === 'onStateChange' && event) {
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
        console.error('YouTube Player Error:', event?.data);
        setState((s) => ({ ...s, playing: false, loading: false, error: 'Failed to load media' }));

        // Auto-skip on error if there are multiple tracks to prevent dead ends
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          if (unmounted) return;
          // Don't auto-skip if the iframe is dead — the manager will handle
          // recovery via rebuild; skipping here would just hit a zombie player.
          if (!isIframeAlive()) return;
          const currentTracks = tracksRef.current;
          if (currentTracks.length > 1) {
            const nextIndex = (stateRef.current.currentIndex + 1) % currentTracks.length;
            loadAndPlayRef.current(nextIndex);
          }
        }, 2000);
      }
    };

    const unsubscribe = subscribeToManager(handleEvent);

    ensurePlayer().then(() => {
      if (unmounted) return;
      if (isPlayerReady()) {
        setState((s) => ({ ...s, loading: false }));
      }
    });

    return () => {
      unmounted = true;
      unsubscribe();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [playerId, timeStore]);

  // Sync playback time to store via interval (~4 updates/s, matching YT API resolution)
  useEffect(() => {
    if (!state.playing) return;

    const id = setInterval(() => {
      try {
        const ytPlayer = getPlayer();
        if (ytPlayer?.getCurrentTime) {
          timeStore.setCurrentTime(ytPlayer.getCurrentTime());
        }
      } catch {
        // Player might be in a bad state during rebuild — silently ignore
      }
    }, 250);

    return () => clearInterval(id);
  }, [state.playing, timeStore]);

  const loadAndPlay = useCallback(
    (index: number) => {
      const currentTracks = tracksRef.current;
      const ytPlayer = getPlayer();
      if (!isPlayerReady() || !ytPlayer || !currentTracks[index]) return;

      const track = currentTracks[index];
      ytPlayer.loadVideoById(track.youtubeId);
      if (stateRef.current.volume > 0 && !stateRef.current.muted) {
        ytPlayer.unMute();
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
        getPlayer()?.pauseVideo?.();
      }
    });
  }, [playerId]);

  const play = useCallback(
    (index?: number) => {
      const ytPlayer = getPlayer();
      if (!isPlayerReady() || !ytPlayer || tracksRef.current.length === 0) return;
      const targetIndex = index ?? state.currentIndex;

      const isActive = $activePlayerId.get() === playerId;

      // Check if we need to load a new track
      if (index != null || !isActive) {
        loadAndPlay(targetIndex);
      } else {
        // Just resume current
        ytPlayer.playVideo();
        $activePlayerId.set(playerId);
      }
    },
    [state.currentIndex, loadAndPlay, playerId],
  );

  const pause = useCallback(() => {
    const ytPlayer = getPlayer();
    if (isPlayerReady() && ytPlayer?.pauseVideo) {
      ytPlayer.pauseVideo();
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
      const ytPlayer = getPlayer();
      if (isPlayerReady() && ytPlayer?.seekTo) {
        ytPlayer.seekTo(time, true);
        timeStore.setCurrentTime(time);
      }
    },
    [timeStore],
  );

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    const ytPlayer = getPlayer();
    if (isPlayerReady() && ytPlayer?.setVolume) {
      ytPlayer.setVolume(clamped * 100);
      if (clamped > 0 && stateRef.current.muted) {
        ytPlayer.unMute();
      }
    }
    setStoredVolume(clamped);
    setState((s) => ({ ...s, volume: clamped, muted: clamped === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    const ytPlayer = getPlayer();
    if (!isPlayerReady() || !ytPlayer) return;
    const newMuted = !state.muted;
    if (newMuted) {
      ytPlayer.mute();
    } else {
      ytPlayer.unMute();
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
