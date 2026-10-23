import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { useId, useRef, useState } from 'react';
import { TagItem } from './TagItem';

interface TagData {
  tag: string;
  count: number;
  colorIndex: number;
}

interface CollapsibleTagsProps {
  tags: TagData[];
  locale?: string;
}

export function CollapsibleTags({ tags, locale }: CollapsibleTagsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  if (tags.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => {
          if (isExpanded && contentRef.current?.contains(document.activeElement)) {
            triggerRef.current?.focus();
          }
          setIsExpanded(!isExpanded);
        }}
        className="mx-4 mt-4 flex cursor-pointer items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-blue md:mx-0"
      >
        <span>{isExpanded ? t('common.collapse') : t('tag.expandAll')}</span>
        <span className="rounded-full bg-white/10 px-1.5 text-xs">{tags.length}</span>
        <Icon icon="ri:arrow-down-s-line" className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      <div
        ref={contentRef}
        id={contentId}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        inert={!isExpanded}
        aria-hidden={!isExpanded}
      >
        <div className="flex flex-wrap gap-3 overflow-hidden px-4 pt-3 md:px-0" style={{ minHeight: 0 }}>
          {tags.map((props) => (
            <TagItem key={props.tag} {...props} locale={locale} />
          ))}
        </div>
      </div>
    </>
  );
}
