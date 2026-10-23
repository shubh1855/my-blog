/**
 * Copy button with animated checkmark feedback.
 * Uses useCopyToClipboard hook for state management.
 */

import { useCopyToClipboard } from '@hooks/useCopyToClipboard';
import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { cn } from '@lib/utils';
import { useEffect, useRef } from 'react';
import { CheckIcon } from './icons';

interface CopyButtonProps {
  text: string;
  className?: string;
  showLabel?: boolean;
}

export function CopyButton({ text, className, showLabel }: CopyButtonProps) {
  const { copied, failed, copy } = useCopyToClipboard();
  const { t } = useTranslation();
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const label = copied ? t('common.copied') : t('common.copy');

  useEffect(() => {
    if (failed) {
      const panel = fallbackRef.current?.parentElement;
      if (panel) {
        const bounds = panel.getBoundingClientRect();
        const offset = Math.max(16 - bounds.left, Math.min(0, window.innerWidth - 16 - bounds.right));
        panel.style.transform = `translateX(${offset}px)`;
      }
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [failed]);

  return (
    <div className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => copy(text)}
        className={cn(
          'flex items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-accent-foreground active:scale-95',
          showLabel ? 'gap-2 px-3 py-1.5' : 'h-8 w-8',
          copied && 'text-primary',
          className,
        )}
        aria-label={label}
        title={label}
      >
        {copied ? <CheckIcon /> : <Icon icon="ri:file-copy-line" className="size-4" />}
        {showLabel && <span className="text-sm">{label}</span>}
      </button>
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {copied ? t('common.copied') : failed ? t('common.copyTextFailed') : ''}
      </output>
      {failed && (
        <div className="absolute top-full right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="text-destructive text-sm">{t('common.copyTextFailed')}</p>
          <textarea
            ref={fallbackRef}
            readOnly
            value={text}
            aria-label={t('common.copyManually')}
            className="w-full rounded-md border border-input bg-background p-2 text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={Math.min(5, Math.max(2, text.split('\n').length))}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
