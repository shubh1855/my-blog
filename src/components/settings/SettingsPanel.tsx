/**
 * Lazy-loading shell for the Settings Center.
 *
 * The panel body is fetched on user intent or first open, then stays mounted so its exit animation can run.
 */

import { ErrorBoundary } from '@components/common/ErrorBoundary';
import { useTranslation } from '@hooks/useTranslation';
import { useStore } from '@nanostores/react';
import { $isSettingsOpen, closeModal } from '@store/modal';
import { lazy, Suspense, useEffect, useState } from 'react';

const createSettingsPanelContent = () => lazy(() => import('./SettingsPanelContent'));

export function preloadSettingsPanel(): void {
  void import('./SettingsPanelContent').catch(() => undefined);
}

export default function SettingsPanel() {
  const { t } = useTranslation();
  const open = useStore($isSettingsOpen);
  const [loaded, setLoaded] = useState(false);
  const [SettingsPanelContent, setSettingsPanelContent] = useState(createSettingsPanelContent);

  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  if (!loaded) return null;
  return (
    <ErrorBoundary
      onReset={() => setSettingsPanelContent(() => createSettingsPanelContent())}
      fallbackRender={({ resetErrorBoundary }) =>
        open ? (
          <div
            role="alert"
            className="fixed right-16 bottom-20 z-40 flex w-80 max-w-[calc(100vw-5rem)] items-center justify-between gap-4 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl"
          >
            <span className="text-sm">{t('settings.loadFailed')}</span>
            <div className="flex shrink-0 items-center gap-3">
              <button type="button" className="text-sm underline underline-offset-4" onClick={resetErrorBoundary}>
                {t('settings.retry')}
              </button>
              <button type="button" className="text-sm underline underline-offset-4" onClick={closeModal}>
                {t('settings.closePanel')}
              </button>
            </div>
          </div>
        ) : null
      }
    >
      <Suspense
        fallback={
          open ? (
            <div
              aria-live="polite"
              className="fixed right-16 bottom-20 z-40 flex max-w-[calc(100vw-5rem)] items-center justify-between gap-4 rounded-xl border border-border bg-popover px-4 py-3 text-popover-foreground text-sm shadow-xl"
            >
              <span>{t('settings.loading')}</span>
              <button type="button" className="shrink-0 underline underline-offset-4" onClick={closeModal}>
                {t('settings.closePanel')}
              </button>
            </div>
          ) : null
        }
      >
        <SettingsPanelContent />
      </Suspense>
    </ErrorBoundary>
  );
}
