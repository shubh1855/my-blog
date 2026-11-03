/**
 * FloatingGroup Component
 *
 * Floating action buttons for navigation and utilities.
 * - Scroll to top/bottom
 * - Expand/collapse toggle
 */

import geassSymbol from '@assets/svg/geass-symbol.svg?url';
import { LazyMotionProvider } from '@components/common/LazyMotionProvider';
import { preloadSettingsPanel } from '@components/settings/SettingsPanel';
import { bgmConfig } from '@constants/site-config';
import { useMediaQuery, usePrefersReducedMotion } from '@hooks/useMediaQuery';
import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { cn } from '@lib/utils';
import { useStore } from '@nanostores/react';
import { $bgmPanelOpen, toggleBgmPanel } from '@store/bgm';
import { $isDrawerOpen, $isSettingsOpen, toggleSettings } from '@store/modal';
import { bgmWidgetEnabled, initSettings } from '@store/settings';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface FloatingButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Optional data attribute for identifying BGM toggle button */
  dataBgmToggle?: boolean;
  /** Optional data attribute for identifying settings toggle button */
  dataSettingsToggle?: boolean;
  /** Optional preload callback for controls that reveal lazy UI. */
  onIntent?: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  ariaControls?: string;
  ariaExpanded?: boolean;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function scrollToBottom() {
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}

function FloatingButton({
  onClick,
  ariaLabel,
  title,
  children,
  className,
  dataBgmToggle,
  dataSettingsToggle,
  onIntent,
  buttonRef,
  ariaControls,
  ariaExpanded,
}: FloatingButtonProps) {
  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onClick}
      onPointerEnter={onIntent}
      onPointerDown={onIntent}
      onFocus={onIntent}
      className={cn(
        'group/floating-button relative tablet:flex tablet:size-11 tablet:items-center tablet:justify-center rounded-full bg-background/80 p-2 opacity-80 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-background hover:opacity-100',
        className,
      )}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      data-bgm-toggle={dataBgmToggle || undefined}
      data-settings-toggle={dataSettingsToggle || undefined}
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-[calc(100%+10px)] tablet:hidden -translate-y-1/2 whitespace-nowrap rounded bg-[#333] px-2 py-1 text-sm text-white opacity-0 transition-opacity group-hover/floating-button:opacity-100 group-focus-visible/floating-button:opacity-100"
      >
        {title}
        <span className="absolute top-1/2 left-full -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[#333] border-l-[6px]" />
      </span>
    </button>
  );
}

export default function FloatingGroup() {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 992px)');
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isExpanded, setIsExpanded] = useState(() => !window.matchMedia('(max-width: 992px)').matches);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<HTMLFieldSetElement>(null);
  const isDrawerOpen = useStore($isDrawerOpen);
  const isBgmPanelOpen = useStore($bgmPanelOpen);
  const isSettingsOpen = useStore($isSettingsOpen);
  const isBgmWidgetEnabled = useStore(bgmWidgetEnabled);

  // Initialize settings state on mount
  useEffect(() => {
    initSettings();
  }, []);

  useEffect(() => {
    if (isMobile && controlsRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
    setIsExpanded(!isMobile);
  }, [isMobile]);

  const toggleExpand = () => {
    if (isExpanded && controlsRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
    setIsExpanded((prev) => !prev);
  };

  // Hide when drawer is open
  const isHidden = isDrawerOpen;

  return (
    <LazyMotionProvider>
      <m.div
        className="fixed right-4 tablet:right-0 bottom-4 tablet:bottom-0 tablet:left-0 z-50 flex tablet:flex-row flex-col tablet:justify-end gap-2 tablet:gap-2 tablet:bg-background tablet:pt-3 tablet:pr-[max(1rem,env(safe-area-inset-right))] tablet:pb-[calc(0.75rem+env(safe-area-inset-bottom))] tablet:pl-[max(1rem,env(safe-area-inset-left))] text-primary tablet:shadow-lg"
        inert={isHidden}
        aria-hidden={isHidden}
        animate={{
          x: isHidden && !isMobile ? 200 : 0,
          opacity: isHidden ? 0 : 1,
          pointerEvents: isHidden ? 'none' : 'auto',
        }}
        transition={{ duration: prefersReducedMotion || isMobile ? 0 : 0.3, ease: 'easeInOut' }}
      >
        <fieldset
          id="floating-toolbar-controls"
          ref={controlsRef}
          className="m-0 min-w-0 border-0 p-0"
          aria-label={t('floating.pageControls')}
          aria-hidden={!isExpanded}
          inert={!isExpanded}
          disabled={!isExpanded}
        >
          <AnimatePresence initial={false}>
            {isExpanded && (
              <m.div
                className="flex tablet:flex-row flex-col tablet:items-center gap-2"
                initial={isMobile || prefersReducedMotion ? false : { y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={isMobile || prefersReducedMotion ? { opacity: 0 } : { y: 50, opacity: 0 }}
                transition={{ duration: isMobile || prefersReducedMotion ? 0 : 0.15, ease: 'easeInOut' }}
              >
                {bgmConfig.enabled && bgmConfig.audio.length > 0 && isBgmWidgetEnabled && (
                  <FloatingButton
                    onClick={toggleBgmPanel}
                    ariaLabel={t('floating.bgm')}
                    title={t('floating.bgm')}
                    dataBgmToggle
                  >
                    <Icon icon={isBgmPanelOpen ? 'ri:music-2-fill' : 'ri:music-2-line'} className="h-5 w-5" />
                  </FloatingButton>
                )}
                <FloatingButton
                  onClick={toggleSettings}
                  ariaLabel={t('floating.settings')}
                  title={t('floating.settings')}
                  dataSettingsToggle
                  onIntent={preloadSettingsPanel}
                >
                  <Icon icon={isSettingsOpen ? 'ri:settings-3-fill' : 'ri:settings-3-line'} className="h-5 w-5" />
                </FloatingButton>
                <FloatingButton onClick={scrollToTop} ariaLabel={t('floating.backToTop')} title={t('floating.backToTop')}>
                  <Icon icon="ri:arrow-up-s-line" className="h-5 w-5" />
                </FloatingButton>
                <FloatingButton
                  onClick={scrollToBottom}
                  ariaLabel={t('floating.scrollToBottom')}
                  title={t('floating.scrollToBottom')}
                >
                  <Icon icon="ri:arrow-down-s-line" className="h-5 w-5" />
                </FloatingButton>
              </m.div>
            )}
          </AnimatePresence>
        </fieldset>

        <FloatingButton
          onClick={toggleExpand}
          buttonRef={toggleRef}
          ariaControls="floating-toolbar-controls"
          ariaExpanded={isExpanded}
          ariaLabel={t('floating.toggleToolbar')}
          title={t('floating.toggleToolbar')}
          className="flex size-12 tablet:size-11 items-center justify-center border border-primary/30"
        >
          {isExpanded ? (
            <Icon icon="ri:close-large-fill" className="size-6" />
          ) : (
            <span className="geass-btn-icon flex items-center justify-center">
              <img src={geassSymbol} alt="geass" className="size-9" />
            </span>
          )}
        </FloatingButton>
      </m.div>
    </LazyMotionProvider>
  );
}
