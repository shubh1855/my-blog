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

function generatePlaceholderContributions(): ContributionResponse {
  const contributions = Array.from(
    { length: 371 },
    (_, index): Contribution => ({
      date: new Date(Date.now() - (371 - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      count: 0,
      level: 0,
    }),
  );

  return {
    contributions,
    total: { lastYear: 0 },
  };
}

const ERROR_PATTERN = [
  [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
] as const;

function generateErrorContributions(): ContributionResponse {
  const contributions = Array.from({ length: 371 }, (_, index): Contribution => {
    const weekIndex = Math.floor(index / 7);
    const dayIndex = index % 7;
    const patternStartWeek = Math.floor((53 - 19) / 2);
    const patternStartRow = Math.floor((7 - 5) / 2);
    const relativeWeek = weekIndex - patternStartWeek;
    const relativeRow = dayIndex - patternStartRow;

    let count = 0;
    if (relativeWeek >= 0 && relativeWeek < 19 && relativeRow >= 0 && relativeRow < 5) {
      count = ERROR_PATTERN[relativeRow]?.[relativeWeek] === 1 ? 10 : 0;
    }

    return { date: '1', count, level: 0 };
  });

  return { contributions, total: { lastYear: 0 } };
}

async function fetchContributions(username: string): Promise<ContributionResponse> {
  const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ContributionResponse | null>(generatePlaceholderContributions());
  const [totalContributions, setTotalContributions] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const scrollToRight = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  useEffect(() => {
    fetchContributions(username)
      .then((res) => {
        setData(res);
        setTotalContributions(res.total?.lastYear ?? 0);
        setIsLoaded(true);
        setTimeout(scrollToRight, 100);
      })
      .catch(() => {
        setData(generateErrorContributions());
      });
  }, [username, scrollToRight]);

  const weeks =
    data?.contributions.reduce<Contribution[][]>((acc, day, index) => {
      const weekIndex = Math.floor(index / 7);
      if (!acc[weekIndex]) {
        acc[weekIndex] = [];
      }
      acc[weekIndex].push(day);
      return acc;
    }, []) || [];

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, contribution: Contribution) => {
      if (!isLoaded || !wrapperRef.current) return;
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const cellRect = e.currentTarget.getBoundingClientRect();
      const x = cellRect.left + cellRect.width / 2 - wrapperRect.left;
      const y = cellRect.top - wrapperRect.top;
      const { count, date } = contribution;
      const text = `${count} contribution${count !== 1 ? 's' : ''} on ${formatDate(date)}`;
      setTooltip({ text, x, y });
    },
    [isLoaded],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="contrib-wrapper not-prose my-6 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">
          {totalContributions > 0 ? `${totalContributions} contributions in the last year` : 'Contributions'}
        </h3>
      </div>

      <div className="relative">
        {tooltip && (
          <div
            className="contrib-tooltip"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
            }}
          >
            {tooltip.text}
          </div>
        )}

        <div ref={containerRef} className="contrib-scroll grid grid-flow-col gap-[3px] overflow-x-auto scroll-smooth py-1">
          {weeks.map((week) => (
            <div key={week[0]?.date || Math.random().toString()} className="grid grid-rows-7 gap-[3px]">
              {week.map((contribution) => {
                const { count, date } = contribution;
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: tooltip wrapper
                  <div
                    key={date}
                    onMouseEnter={(e) => handleMouseEnter(e, contribution)}
                    onMouseLeave={handleMouseLeave}
                    className={cn(
                      'size-[10px] rounded-[2px] transition-colors duration-300',
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
        </div>
      </div>

      <style>{`
        .contrib-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .contrib-scroll::-webkit-scrollbar {
          display: none;
        }
        .contrib-tooltip {
          position: absolute;
          transform: translate(-50%, -100%) translateY(-8px);
          padding: 4px 10px;
          border-radius: 6px;
          background: hsl(var(--popover));
          border: 1px solid hsl(var(--border));
          color: hsl(var(--popover-foreground));
          font-size: 11px;
          line-height: 1.4;
          white-space: nowrap;
          pointer-events: none;
          z-index: 50;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
      `}</style>
    </div>
  );
}
