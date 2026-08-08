/**
 * PlayerPreview — vinyl disc with tonearm (left) + song info + centered lyrics (right).
 */

import type { MetingSong } from '@lib/meting';
import type { PlaybackTimeStore } from '@lib/playback-time-store';
import { cn } from '@lib/utils';
import { memo } from 'react';

interface PlayerPreviewProps {
  track: MetingSong | null;
  playing: boolean;
  timeStore: PlaybackTimeStore;
}

export const PlayerPreview = memo(function PlayerPreview({ track, playing }: PlayerPreviewProps) {
  return (
    <div className="audio-player-preview">
      {/* Disc wrapper: vinyl disc + tonearm */}
      <div className="audio-player-disc-wrapper">
        <div className={cn('audio-player-disc', playing && 'spinning')}>
          {track?.pic ? (
            <img src={track.pic} alt={track.name || ''} className="audio-player-cover" draggable={false} />
          ) : (
            <div className="audio-player-cover audio-player-cover-placeholder" />
          )}
        </div>
        <div className={cn('audio-player-needle', playing && 'playing')}>
          <div className="audio-player-needle-arm">
            <div className="audio-player-needle-head" />
          </div>
        </div>
      </div>

      {/* Song info (lyrics removed) */}
      <div className="audio-player-info">
        <div className="audio-player-song-name" title={track?.name}>
          {track?.name || 'No track'}
        </div>
        <div className="audio-player-artist" title={track?.artist}>
          {track?.artist || ''}
        </div>
      </div>
    </div>
  );
});
