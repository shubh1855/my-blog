import { useTranslation } from '@hooks/useTranslation';
import { buildTagPath } from '@lib/content/tags';
import { localizedPath } from '@/i18n';

interface TagItemProps {
  tag: string;
  count: number;
  locale?: string;
}

export function TagItem({ tag, count, locale }: TagItemProps) {
  const { t } = useTranslation();
  return (
    <a
      href={localizedPath(buildTagPath(tag), locale)}
      aria-label={t('tag.viewTagPosts', { tag, count })}
      className="relative flex items-center rounded-sm border border-primary/25 bg-primary/8 px-3 py-1.5 text-foreground text-sm transition-colors duration-200 hover:border-primary/60 hover:bg-primary/15"
    >
      <span className="font-medium">{tag}</span>
      <span className="ml-1.5 truncate text-muted-foreground text-xs">{count}</span>
    </a>
  );
}
