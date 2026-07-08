import { useTranslation } from '@hooks/useTranslation';
import { buildTagPath } from '@lib/content/tags';
import { localizedPath } from '@/i18n';

const TAG_COLORS = [
  'bg-[#0f0b1d] border border-[#b050a0]/30 text-[#b050a0]/80 hover:bg-[#b050a0]/15 hover:text-[#b858a8] hover:border-[#b050a0]/50',
  'bg-[#0f0b1d] border border-[#8a2666]/30 text-[#8a2666]/80 hover:bg-[#8a2666]/15 hover:text-[#c04080] hover:border-[#8a2666]/50',
  'bg-[#0f0b1d] border border-[#7a3060]/30 text-[#988892]/80 hover:bg-[#7a3060]/15 hover:text-[#988892] hover:border-[#7a3060]/50',
  'bg-[#0f0b1d] border border-[#402048]/50 text-[#988892]/70 hover:bg-[#402048]/30 hover:text-[#b858a8] hover:border-[#402048]',
];

interface TagItemProps {
  tag: string;
  count: number;
  colorIndex: number;
  locale?: string;
}

export function TagItem({ tag, count, colorIndex, locale }: TagItemProps) {
  const { t } = useTranslation();
  return (
    <a
      href={localizedPath(buildTagPath(tag), locale)}
      aria-label={t('tag.viewTagPosts', { tag, count })}
      className={`relative flex items-center rounded-lg px-3 py-1.5 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${TAG_COLORS[colorIndex % TAG_COLORS.length]}`}
    >
      <span className="font-medium">{tag}</span>
      <span className="ml-1.5 truncate rounded-full bg-white/10 px-1.5 text-xs">{count}</span>
    </a>
  );
}
