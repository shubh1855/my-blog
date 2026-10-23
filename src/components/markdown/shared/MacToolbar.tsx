/**
 * Shared toolbar component for code blocks, mermaid, and infographic diagrams.
 * Renders language label on the left, action buttons (children) on the right.
 */

import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { cn } from '@lib/utils';

interface MacToolbarProps {
  language: string;
  title?: string;
  url?: string;
  linkText?: string;
  className?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  /** @deprecated Traffic lights removed; prop kept for API compatibility */
  onFullscreen?: () => void;
}

export function MacToolbar({ language, title, url, linkText, className, children, onClose }: MacToolbarProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col border border-border border-b-0 bg-muted/50 backdrop-blur-sm',
        'rounded-t-xl shadow-md',
        'dark:bg-muted/30',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between pr-2 pl-4">
        <div className="flex items-center gap-3 py-2">
          <span className="font-medium font-mono text-muted-foreground text-xs uppercase tracking-wider">{language}</span>
        </div>
        {(children || onClose) && (
          <div className="ml-auto flex flex-wrap items-center gap-1 py-1">
            {children}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <Icon icon="ri:close-line" className="size-4" />
                <span className="text-sm">{t('common.close')}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {(title || url) && (
        <div className="code-block-title">
          {title && <span>{title}</span>}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {linkText || url}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
