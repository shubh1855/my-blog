import { LazyMotionProvider } from '@components/common/LazyMotionProvider';
import { useTranslation } from '@hooks/useTranslation';
import { cn } from '@lib/utils';
import { m } from 'motion/react';

interface QuizGapProps {
  answer: string;
  revealed: boolean;
  onClick: () => void;
  isMistake?: boolean;
}

export function QuizGap({ answer, revealed, onClick, isMistake }: QuizGapProps) {
  const { t } = useTranslation();
  return (
    <LazyMotionProvider>
      <m.button
        type="button"
        onClick={revealed ? undefined : onClick}
        aria-disabled={revealed}
        aria-label={revealed ? undefined : t('quiz.clickToReveal')}
        aria-live="polite"
        className={cn(
          'inline-block rounded px-1.5 py-0.5',
          !revealed &&
            'cursor-pointer border-primary/50 border-b-2 border-dashed px-4 text-transparent transition-colors hover:border-primary hover:bg-primary/5',
          revealed && 'font-semibold',
          revealed &&
            (isMistake
              ? 'bg-red-100 text-red-600 line-through dark:bg-red-950/40 dark:text-red-400'
              : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'),
        )}
      >
        {answer}
      </m.button>
    </LazyMotionProvider>
  );
}
