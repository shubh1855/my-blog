/**
 * Singleton YouTube player lifecycle manager.
 *
 * Manages the global YouTube IFrame player instance, handling creation,
 * destruction, and rebuilding across Astro View Transitions.
 *
 * Problem: Astro's ClientRouter swaps the DOM during page navigation. The
 * YouTube iframe (dynamically injected by client-side JS) has no matching
 * `transition:persist` element in the incoming server-rendered HTML, so Astro
 * destroys it on every navigation. The JS object (`YT.Player`) becomes a
 * "zombie" — methods silently fail because the underlying iframe is gone.
 *
 * Solution: Hook into Astro's lifecycle events to snapshot playback state
 * before the swap (`astro:before-swap`) and rebuild the iframe + restore
 * playback after the new page loads (`astro:page-load`).
 *
 * This module is the single source of truth for the YouTube player instance.
 * React hooks (`useYouTubePlayer`) subscribe to events and delegate all
 * iframe lifecycle operations here.
 */

import { getStoredVolume } from '../store/player';

// ─── Types ───────────────────────────────────────────────────────────

export interface YTPlayerEvent {
  data: number;
  target: YTPlayerInstance;
}

export interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoUrl: () => string;
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

declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady: () => void;
  }
}

/** Event types dispatched to subscribers. `'rebuilding'` is a custom type
 *  fired when the manager begins an iframe rebuild (event payload is null). */
export type YTEventType = 'onReady' | 'onStateChange' | 'onError' | 'rebuilding';
export type YTEventListener = (event: YTPlayerEvent | null, type: YTEventType) => void;

// ─── Module State ────────────────────────────────────────────────────

interface PlayerSnapshot {
  videoId: string | null;
  currentTime: number;
  wasPlaying: boolean;
  /** Raw YT volume 0–100 */
  volume: number;
  muted: boolean;
}

let player: YTPlayerInstance | null = null;
let ready = false;
let snapshot: PlayerSnapshot | null = null;
let pendingSeekTime: number | null = null;
/** True while a restore (load video → seek) is in progress. Prevents
 *  `handleBeforeSwap` from overwriting the good snapshot with a stale one
 *  during rapid consecutive navigations. */
let restoring = false;
const listeners = new Set<YTEventListener>();

// ─── YouTube API Loading ─────────────────────────────────────────────

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      // Chain existing callback (if any) to avoid overwrite races when
      // multiple consumers call loadYouTubeApi before the script loads.
      const existingCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof existingCb === 'function') existingCb();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    });
  }
  return ytApiPromise;
}

// ─── Container Management ────────────────────────────────────────────

/** Create the off-screen container that hosts the YT iframe. */
function createContainer(): void {
  if (document.getElementById('yt-player-mount')) return;

  const container = document.createElement('div');
  container.id = 'yt-player-mount';
  container.style.cssText = 'position:absolute;width:200px;height:200px;top:-9999px;left:-9999px;opacity:1;pointer-events:none';

  const mountPoint = document.createElement('div');
  mountPoint.id = 'yt-player-iframe';
  container.appendChild(mountPoint);

  document.body.appendChild(container);
}

/** Check whether the YT iframe element is present in the DOM. */
export function isIframeAlive(): boolean {
  const mount = document.getElementById('yt-player-mount');
  return !!mount?.querySelector('iframe');
}

// ─── Listener Bus ────────────────────────────────────────────────────

function notifyListeners(event: YTPlayerEvent | null, type: YTEventType): void {
  for (const listener of listeners) {
    listener(event, type);
  }
}

// ─── Player Creation ─────────────────────────────────────────────────

function createPlayerInstance(): void {
  player = new window.YT.Player('yt-player-iframe', {
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
        ready = true;

        // Restore volume from snapshot, or fall back to localStorage
        if (snapshot) {
          event.target.setVolume(snapshot.volume);
          if (snapshot.muted) event.target.mute();
          else event.target.unMute();
        } else {
          const vol = getStoredVolume();
          event.target.setVolume(vol * 100);
          if (vol > 0) event.target.unMute();
        }

        // Notify all listeners that the player is ready
        notifyListeners(event, 'onReady');

        // Restore playback if music was playing before the page transition
        if (snapshot?.wasPlaying && snapshot.videoId) {
          restoring = true;
          pendingSeekTime = snapshot.currentTime;
          event.target.loadVideoById(snapshot.videoId);
          // snapshot is NOT cleared here — kept until seek completes so that
          // rapid navigation can fall back to the original snapshot.
        } else {
          snapshot = null;
          restoring = false;
        }
      },

      onStateChange: (event: YTPlayerEvent) => {
        // After restore: once the video reaches PLAYING, seek to the saved
        // timestamp for seamless continuity, then clear the restore state.
        if (pendingSeekTime !== null && event.data === window.YT.PlayerState.PLAYING) {
          const seekTime = pendingSeekTime;
          pendingSeekTime = null;
          event.target.seekTo(seekTime, true);
          restoring = false;
          snapshot = null;
        }

        notifyListeners(event, 'onStateChange');
      },

      onError: (event: YTPlayerEvent) => {
        // Clear restore state on error — the hook's error handler will
        // attempt auto-skip to the next track as a fallback.
        pendingSeekTime = null;
        restoring = false;
        snapshot = null;

        notifyListeners(event, 'onError');
      },
    },
  });
}

// ─── Snapshot ─────────────────────────────────────────────────────────

/** Capture the current player state for later restoration. */
function snapshotState(): PlayerSnapshot | null {
  if (!player || !ready) return null;
  try {
    let videoId: string | null = null;
    try {
      const url = player.getVideoUrl();
      if (url) {
        const parsed = new URL(url);
        videoId = parsed.searchParams.get('v');
      }
    } catch {
      /* no video loaded or unparseable URL */
    }

    return {
      videoId,
      currentTime: player.getCurrentTime(),
      wasPlaying: player.getPlayerState() === window.YT.PlayerState.PLAYING,
      volume: player.getVolume(),
      muted: player.isMuted(),
    };
  } catch {
    return null;
  }
}

// ─── Rebuild ──────────────────────────────────────────────────────────

/** Destroy the zombie player, create a fresh iframe, and restore playback. */
function rebuild(): void {
  ready = false;
  pendingSeekTime = null;
  // Note: `restoring` and `snapshot` are intentionally NOT reset here.
  // During rapid navigations the original (good) snapshot is preserved
  // because `handleBeforeSwap` skips overwriting while `restoring` is true.

  // Tell hooks to show a loading state immediately
  notifyListeners(null, 'rebuilding');

  // Destroy the zombie player instance
  try {
    player?.destroy();
  } catch {
    /* may already be destroyed or in a bad state */
  }
  player = null;

  // Remove dead container and create a fresh one
  document.getElementById('yt-player-mount')?.remove();
  createContainer();
  createPlayerInstance();
}

// ─── Astro Lifecycle ──────────────────────────────────────────────────

function handleBeforeSwap(): void {
  // During an active restore (loadVideoById → seekTo in progress), don't
  // overwrite the good snapshot with a stale mid-restore one.
  if (restoring) return;

  const newSnapshot = snapshotState();
  // Keep the previous snapshot if a new one can't be captured (e.g., player
  // not ready during rapid back-to-back navigations).
  if (newSnapshot) snapshot = newSnapshot;
}

function handlePageLoad(): void {
  // No player ever created — initial page load; ensurePlayer() will handle it
  if (!player) return;

  // Player existed but iframe was destroyed by the View Transition DOM swap
  if (!isIframeAlive()) {
    rebuild();
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/** Load the YouTube IFrame API and create the player if it doesn't exist. */
export async function ensurePlayer(): Promise<void> {
  await loadYouTubeApi();
  if (player) return;
  createContainer();
  createPlayerInstance();
}

/** Get the current YouTube player instance (may be null during rebuilds). */
export function getPlayer(): YTPlayerInstance | null {
  return player;
}

/** Whether the YouTube player is ready to accept API calls. */
export function isPlayerReady(): boolean {
  return ready;
}

/** Subscribe to player events. Returns an unsubscribe function. */
export function subscribe(listener: YTEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── Auto-initialization ─────────────────────────────────────────────
// Register Astro lifecycle listeners when this module first loads.
// Module-level variables survive DOM swaps (JS environment is preserved
// by Astro's ClientRouter), so these listeners stay active across
// navigations without re-registration.

if (typeof document !== 'undefined') {
  document.addEventListener('astro:before-swap', handleBeforeSwap);
  document.addEventListener('astro:page-load', handlePageLoad);
}
