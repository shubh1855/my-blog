import { ErrorBoundary } from '@components/common/ErrorBoundary';
import { useTranslation } from '@hooks/useTranslation';
import type { BgmAudioGroup } from '@lib/config/types';
import { useStore } from '@nanostores/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { $bgmPanelOpen, closeBgmPanel } from '@/store/bgm';

const createBGMPlayerContent = () => lazy(() => import('./BGMPlayerContent'));

/** Load YouTube and the player UI on first open, then keep playback mounted. */
export default function GlobalBGMPlayer({ audioGroups }: { audioGroups: BgmAudioGroup[] }) {
  const { t } = useTranslation();
  const open = useStore($bgmPanelOpen);
  const [loaded, setLoaded] = useState(false);
  const [LazyBGMPlayerContent, setLazyBGMPlayerContent] = useState(createBGMPlayerContent);

  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  if (!loaded) return null;

  return (
    <ErrorBoundary
      onReset={() => setLazyBGMPlayerContent(() => createBGMPlayerContent())}
      fallbackRender={({ resetErrorBoundary }) =>
        open && (
          <div
            className="fixed right-16 bottom-20 z-40 flex w-[460px] max-w-[calc(100vw-5rem)] items-center justify-between gap-4 rounded-2xl bg-background p-5 text-sm shadow-xl"
            role="alert"
          >
            <span>{t('audio.playerLoadFailed')}</span>
            <button type="button" className="shrink-0 underline underline-offset-4" onClick={resetErrorBoundary}>
              {t('audio.retry')}
            </button>
            <button type="button" className="shrink-0 underline underline-offset-4" onClick={closeBgmPanel}>
              {t('audio.closePanel')}
            </button>
          </div>
        )
      }
    >
      <Suspense
        fallback={
          open && (
            <output className="fixed right-16 bottom-20 z-40 rounded-2xl bg-background p-5 text-sm shadow-xl">
              {t('audio.loading')}
            </output>
          )
        }
      >
        <LazyBGMPlayerContent audioGroups={audioGroups} />
      </Suspense>
    </ErrorBoundary>
  );
}
