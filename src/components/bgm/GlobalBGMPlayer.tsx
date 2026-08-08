/**
 * GlobalBGMPlayer — floating background music player panel.
 *
 * Audio element lives at the component top level (outside AnimatePresence)
 * so that music continues playing when the panel UI is closed.
 * The panel is rendered via AnimatePresence for smooth enter/exit transitions.
 *
 * Playlist resolution is lazy — only triggered on first panel open.
 */

import { PlayerPlaylist, type PlaylistGroup } from '@components/markdown/audio-player/PlayerPlaylist';
import { PlayerPreview } from '@components/markdown/audio-player/PlayerPreview';
import { MediaControls } from '@components/markdown/shared/MediaControls';
import { FloatingFocusManager, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';
import { useMediaQuery } from '@hooks/useMediaQuery';
import { useTranslation } from '@hooks/useTranslation';
import { useYouTubePlayer } from '@hooks/useYouTubePlayer';
import { Icon } from '@iconify/react';
import type { BgmAudioGroup, YouTubeTrack } from '@lib/config/types';
import { useStore } from '@nanostores/react';
import { $isAnyModalOpen, $isDrawerOpen } from '@store/modal';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { $bgmPanelOpen, closeBgmPanel } from '@/store/bgm';

interface GlobalBGMPlayerProps {
  audioGroups: BgmAudioGroup[];
}

export default function GlobalBGMPlayer({ audioGroups }: GlobalBGMPlayerProps) {
  const { t } = useTranslation();
  const panelOpen = useStore($bgmPanelOpen);
  const isDrawerOpen = useStore($isDrawerOpen);
  const isAnyModalOpen = useStore($isAnyModalOpen);
  const isMobilePlayer = useMediaQuery('(max-width: 600px)');

  const [tracks, setTracks] = useState<YouTubeTrack[]>([]);
  const [groups, setGroups] = useState<PlaylistGroup[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const allTracks: YouTubeTrack[] = [];
    const resolvedGroups: PlaylistGroup[] = [];
    for (const group of audioGroups) {
      const startIndex = allTracks.length;
      allTracks.push(...group.list);
      resolvedGroups.push({ title: group.title, startIndex, count: group.list.length });
    }
    setTracks(allTracks);
    setGroups(resolvedGroups);
  }, [audioGroups]);

  const player = useYouTubePlayer(tracks);
  const currentTrack = tracks[player.state.currentIndex] ?? null;

  // Hide panel when drawer is open
  const isHidden = isDrawerOpen || isAnyModalOpen;

  // floating-ui: dismiss on ESC / outside click
  const { refs, context } = useFloating({
    open: panelOpen && !isHidden,
    onOpenChange: (open) => {
      if (!open) closeBgmPanel();
    },
  });
  const dismiss = useDismiss(context, {
    outsidePressEvent: 'mousedown',
    // Exclude the BGM toggle button in FloatingGroup to prevent toggle/dismiss race
    outsidePress: (event) => {
      const target = event.target as HTMLElement;
      return !target.closest('[data-bgm-toggle]');
    },
  });
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  const renderPanelContent = () => {
    if (tracks.length === 0) {
      return (
        <div className="audio-player audio-player-empty bgm-panel-player">
          <span>{t('audio.empty')}</span>
        </div>
      );
    }

    return (
      <div className="audio-player not-prose bgm-panel-player">
        <PlayerPreview
          track={currentTrack}
          playing={player.state.playing}
          timeStore={player.timeStore}
          lrcLineHeight={28}
          lrcContainerHeight={isMobilePlayer ? 168 : 140}
        />
        <MediaControls
          playing={player.state.playing}
          loading={player.state.loading}
          mode={player.state.mode}
          volume={player.state.volume}
          muted={player.state.muted}
          timeStore={player.timeStore}
          onTogglePlay={player.togglePlay}
          onPrev={player.prevTrack}
          onNext={player.nextTrack}
          onSeek={player.seek}
          onSetMode={player.setMode}
          onSetVolume={player.setVolume}
          onToggleMute={player.toggleMute}
        />
        <PlayerPlaylist
          tracks={tracks}
          groups={groups}
          currentIndex={player.state.currentIndex}
          timeStore={player.timeStore}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTrackSelect={player.play}
          onSeek={player.seek}
        />
      </div>
    );
  };

  return (
    <AnimatePresence>
      {panelOpen && !isHidden && (
        <FloatingFocusManager context={context} modal={false}>
          <motion.div
            ref={refs.setFloating}
            {...getFloatingProps()}
            className="fixed right-16 bottom-20 z-40 w-[460px] max-w-[calc(100vw-5rem)]"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="bgm-panel max-h-[85vh] overflow-y-auto overscroll-none rounded-2xl shadow-xl sm:max-h-[70vh] sm:overflow-hidden">
              {/* Close button */}
              <button
                type="button"
                className="absolute top-2 right-2 z-10 rounded-full bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
                onClick={closeBgmPanel}
                aria-label={t('audio.closePanel')}
              >
                <Icon icon="ri:close-line" className="h-4 w-4" />
              </button>
              {renderPanelContent()}
            </div>
          </motion.div>
        </FloatingFocusManager>
      )}
    </AnimatePresence>
  );
}
