/**
 * AudioPlayer — main container component for the custom Meting audio player.
 *
 * Rendered via portal from ContentEnhancer. Resolves music URLs through the
 * Meting API at runtime, builds a grouped playlist, and renders the player UI.
 */

import { useAudioPlayer } from '@hooks/useAudioPlayer';
import { useTranslation } from '@hooks/useTranslation';
import type { MetingSong } from '@lib/meting';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayerPlaylist } from './audio-player/PlayerPlaylist';
import { PlayerPreview } from './audio-player/PlayerPreview';
import { MediaControls } from './shared/MediaControls';

interface AudioGroup {
  title?: string;
  list: MetingSong[];
}

interface PlaylistGroup {
  title?: string;
  startIndex: number;
  count: number;
}

interface AudioPlayerProps {
  element: HTMLElement;
}

export function AudioPlayer({ element }: AudioPlayerProps) {
  const { t } = useTranslation();
  const dataSrc = element.dataset.src || '[]';
  
  const audioGroups: AudioGroup[] = useMemo(() => {
    try {
      return JSON.parse(dataSrc);
    } catch {
      return [];
    }
  }, [dataSrc]);

  const [tracks, setTracks] = useState<MetingSong[]>([]);
  const [groups, setGroups] = useState<PlaylistGroup[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const allTracks: MetingSong[] = [];
    const resolvedGroups: PlaylistGroup[] = [];

    for (const group of audioGroups) {
      const startIndex = allTracks.length;
      allTracks.push(...group.list);
      resolvedGroups.push({
        title: group.title,
        startIndex,
        count: group.list.length,
      });
    }

    setTracks(allTracks);
    setGroups(resolvedGroups);
  }, [audioGroups]);

  const player = useAudioPlayer(tracks);
  const currentTrack = tracks[player.state.currentIndex] ?? null;

  const handleTrackSelect = useCallback(
    (index: number) => {
      player.play(index);
    },
    [player.play],
  );

  if (tracks.length === 0) {
    return (
      <div className="audio-player audio-player-empty">
        <span>{t('audio.empty')}</span>
      </div>
    );
  }

  return (
    <div className="audio-player not-prose">
      <PlayerPreview track={currentTrack} playing={player.state.playing} timeStore={player.timeStore} />
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
        onTrackSelect={handleTrackSelect}
        onSeek={player.seek}
      />
    </div>
  );
}
