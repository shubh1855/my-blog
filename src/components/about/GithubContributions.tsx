import { useTranslation } from '@hooks/useTranslation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Contribution {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface ContributionResponse {
  total: {
    [year: number]: number;
    [year: string]: number;
  };
  contributions: Array<Contribution>;
}

interface Props {
  username: string;
}

async function fetchContributions(username: string, signal: AbortSignal, retry: number): Promise<ContributionResponse> {
  const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, {
    signal,
    cache: retry > 0 ? 'reload' : 'default',
  });
  const data = await response.json();

  if (!response.ok) {
    throw Error(`Fetching GitHub contribution data for "${username}" failed: ${data.error}`);
  }

  return data as ContributionResponse;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function GithubContributions({ username }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [data, setData] = useState<ContributionResponse | null>(null);
  const [totalContributions, setTotalContributions] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeDay, setActiveDay] = useState<Contribution | null>(null);

  const scrollToRight = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    setHasError(false);
    setData(null);
    setTotalContributions(0);
    setActiveDay(null);
    setActiveDayIndex(0);
    fetchContributions(username, controller.signal, retry)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setTotalContributions(res.total?.lastYear ?? 0);
        setActiveDayIndex(0);
        setActiveDay(res.contributions[0] ?? null);
        scrollTimer = setTimeout(scrollToRight, 100);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setHasError(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [username, scrollToRight, retry]);

  const weeks =
    data?.contributions.reduce<Contribution[][]>((acc, day, index) => {
      const weekIndex = Math.floor(index / 7);
      if (!acc[weekIndex]) {
        acc[weekIndex] = [];
      }
      acc[weekIndex].push(day);
      return acc;
    }, []) || [];

  const focusDay = (index: number) => {
    const day = data?.contributions[index];
    if (!day) return;
    setActiveDayIndex(index);
    setActiveDay(day);
    cellRefs.current[index]?.focus();
  };

  const handleDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const weekStart = Math.floor(index / 7) * 7;
    const weekEnd = Math.min(weekStart + 6, (data?.contributions.length ?? 0) - 1);
    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = index + 7;
        break;
      case 'ArrowLeft':
        nextIndex = index - 7;
        break;
      case 'ArrowDown':
        nextIndex = index + 1;
        break;
      case 'ArrowUp':
        nextIndex = index - 1;
        break;
      case 'Home':
        nextIndex = weekStart;
        break;
      case 'End':
        nextIndex = weekEnd;
        break;
      default:
        return;
    }
    event.preventDefault();
    focusDay(Math.max(0, Math.min(nextIndex, (data?.contributions.length ?? 1) - 1)));
  };

  const dayDetail = activeDay
    ? `${activeDay.count} contribution${activeDay.count !== 1 ? 's' : ''} on ${formatDate(activeDay.date)}`
    : '';

  return (
    <div className="contrib-wrapper not-prose my-6 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">
          {totalContributions > 0 ? `${totalContributions} contributions in the last year` : 'Contributions'}
        </h3>
        <a
          href={`https://github.com/${encodeURIComponent(username)}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary text-xs underline-offset-4 hover:underline"
        >
          {t('about.viewGithubProfile')}
        </a>
      </div>

      <div className="relative">
        {hasError ? (
          <div
            aria-live="polite"
            className="flex min-h-20 flex-col items-start justify-center gap-2 text-muted-foreground text-sm"
          >
            <p>{t('about.contributionsLoadFailed')}</p>
            <button
              type="button"
              className="text-primary underline underline-offset-4"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t('about.contributionsRetry')}
            </button>
          </div>
        ) : !data ? (
          <div aria-live="polite" className="flex min-h-20 items-center text-muted-foreground text-sm">
            {t('about.contributionsLoading')}
          </div>
        ) : null}
        {data && (
          <fieldset
            ref={containerRef}
            className="contrib-scroll m-0 grid min-w-0 grid-flow-col gap-[3px] overflow-x-auto scroll-smooth border-0 p-0 py-1"
          >
            <legend className="sr-only">{username} GitHub contributions</legend>
            {weeks.map((week, weekIndex) => (
              <div key={week[0]?.date || weekIndex} className="grid grid-rows-7 gap-[3px]">
                {week.map((contribution, dayIndex) => {
                  const flatIndex = weekIndex * 7 + dayIndex;
                  const { count, date } = contribution;
                  return (
                    <button
                      type="button"
                      key={date}
                      ref={(element) => {
                        cellRefs.current[flatIndex] = element;
                      }}
                      tabIndex={flatIndex === activeDayIndex ? 0 : -1}
                      aria-label={`${count} contribution${count !== 1 ? 's' : ''} on ${formatDate(date)}`}
                      onFocus={() => {
                        setActiveDayIndex(flatIndex);
                        setActiveDay(contribution);
                      }}
                      onClick={() => {
                        setActiveDayIndex(flatIndex);
                        setActiveDay(contribution);
                      }}
                      onKeyDown={(event) => handleDayKeyDown(event, flatIndex)}
                      className={cn(
                        'size-[10px] rounded-[2px] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1',
                        count === 0
                          ? 'bg-muted-foreground/10'
                          : count < 5
                            ? 'bg-green-400/50 dark:bg-green-700/60'
                            : count < 10
                              ? 'bg-green-500/70 dark:bg-green-500/70'
                              : 'bg-green-600 dark:bg-green-400',
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </fieldset>
        )}
        {data && (
          <output aria-live="polite" className="mt-2 block min-h-4 text-muted-foreground text-xs">
            {dayDetail}
          </output>
        )}
      </div>

      <style>{`
        .contrib-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .contrib-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
