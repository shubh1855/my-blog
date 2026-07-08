import { useTranslation } from '@hooks/useTranslation';
import { buildTagPath } from '@lib/content/tags';
import { localizedPath } from '@/i18n';

const TAG_COLORS = [
  'bg-[#19112e] border border-[#e80dc3]/30 text-[#e80dc3]/80 hover:bg-[#e80dc3]/20 hover:text-[#e80dc3] hover:border-[#e80dc3]/60',
  'bg-[#19112e] border border-[#b21145]/30 text-[#b21145]/80 hover:bg-[#b21145]/20 hover:text-[#e90ea8] hover:border-[#b21145]/60',
  'bg-[#19112e] border border-[#8a2666]/30 text-[#a994a2]/80 hover:bg-[#8a2666]/20 hover:text-[#a994a2] hover:border-[#8a2666]/60',
  'bg-[#19112e] border border-[#471e4b]/50 text-[#a994a2]/70 hover:bg-[#471e4b]/40 hover:text-[#e815db] hover:border-[#471e4b]',
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
