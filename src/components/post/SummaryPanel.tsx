/**
 * Summary Panel Component
 *
 * 显示文章摘要面板，展开后立即显示完整文本
 * 可展示手写描述、AI 生成摘要或自动提取的内容
 * 支持 prefers-reduced-motion 可访问性
 */

import { ErrorBoundary, InlineErrorFallback } from '@components/common';
import { useTranslation } from '@hooks/useTranslation';
import { cn } from '@lib/utils';
import { memo, type ReactNode, type RefObject, useCallback, useRef, useState } from 'react';
import { RiBook2Fill } from 'react-icons/ri';
import type { TranslationKey } from '@/i18n/types';
import { MingcuteAiFillSvg } from '../svg/MingcuteAiFillSvg.tsx';

export type SummarySource = 'description' | 'ai' | 'auto';

const SummaryPanelContent = memo(
  ({ isExpanded, summary, textRef }: { isExpanded: boolean; summary: string; textRef: RefObject<HTMLSpanElement | null> }) => {
    return (
      <div
        id="summary-panel-content"
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        inert={!isExpanded}
        aria-hidden={!isExpanded}
      >
        <div className="overflow-hidden">
          <div className="rounded-b-lg bg-foreground/5 px-4 py-4 text-muted-foreground text-sm leading-relaxed">
            {/* 屏幕阅读器专用 */}
            <span className="sr-only">{summary}</span>

            {/* 视觉展示 - 通过 ref 直接更新 DOM，避免频繁重渲染 */}
            <p aria-hidden="true">
              <span ref={textRef}>{summary}</span>
            </p>
          </div>
        </div>
      </div>
    );
  },
);

export interface SummaryPanelProps {
  /** 摘要文本 */
  summary: string;
  /** 摘要来源类型 */
  source?: SummarySource;
  /** @deprecated Summaries now display immediately. Kept for caller compatibility. */
  typingSpeed?: number;
  /** 自定义类名 */
  className?: string;
}

const SOURCE_ICONS: Record<SummarySource, ReactNode> = {
  description: <RiBook2Fill className="size-4 text-primary" />,
  ai: <MingcuteAiFillSvg className="size-4 text-primary" />,
  auto: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4 text-primary"
      aria-hidden="true"
    >
      <path d="M20 22H4C3.45 22 3 21.55 3 21V3C3 2.45 3.45 2 4 2H20C20.55 2 21 2.45 21 3V21C21 21.55 20.55 22 20 22ZM19 20V4H5V20H19ZM7 6H11V10H7V6ZM7 12H17V14H7V12ZM7 16H17V18H7V16ZM13 7H17V9H13V7Z" />
    </svg>
  ),
};

const SOURCE_LABEL_KEYS: Record<SummarySource, TranslationKey> = {
  description: 'summary.description',
  ai: 'summary.ai',
  auto: 'summary.auto',
};

function SummaryPanel({ summary, source = 'ai', className }: SummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { t } = useTranslation();
  const icon = SOURCE_ICONS[source];
  const label = t(SOURCE_LABEL_KEYS[source]);

  // 展开/收起
  const handleToggle = useCallback(() => {
    if (isExpanded) {
      if (textRef.current?.closest('#summary-panel-content')?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  return (
    <ErrorBoundary FallbackComponent={InlineErrorFallback}>
      <div className={cn('overflow-hidden rounded-lg', className)}>
        {/* 触发按钮 */}
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between bg-foreground/5 px-4 py-3 transition-all duration-250',
            'hover:bg-foreground/10',
            isExpanded && 'rounded-t-lg bg-foreground/10',
            !isExpanded && 'rounded-lg',
          )}
          aria-expanded={isExpanded}
          aria-controls="summary-panel-content"
        >
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-sm">
            <span className={cn('transition-transform duration-300', isExpanded && source === 'ai' && 'rotate-10')}>
              {icon}
            </span>
            {label}
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn('size-4 text-muted-foreground transition-transform duration-300', isExpanded && 'rotate-180')}
            aria-hidden="true"
          >
            <path d="M12 16L6 10H18L12 16Z" />
          </svg>
        </button>
        <SummaryPanelContent isExpanded={isExpanded} summary={summary} textRef={textRef} />
      </div>
    </ErrorBoundary>
  );
}

export default SummaryPanel;
