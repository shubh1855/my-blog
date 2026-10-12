import type { BgmAudioGroup } from '@lib/config/types';
import { useStore } from '@nanostores/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { $bgmPanelOpen } from '@/store/bgm';

const BGMPlayerContent = lazy(() => import('./BGMPlayerContent'));

/** Load YouTube and the player UI on first open, then keep playback mounted. */
export default function GlobalBGMPlayer({ audioGroups }: { audioGroups: BgmAudioGroup[] }) {
  const open = useStore($bgmPanelOpen);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  if (!loaded) return null;

  return (
    <Suspense fallback={null}>
      <BGMPlayerContent audioGroups={audioGroups} />
    </Suspense>
  );
}
