import { formatInTimeZone } from 'date-fns-tz';

export interface WeekGroup<T> {
  /** Monday of the week as yyyy-MM-dd, in the given timezone */
  weekStart: string;
  /** The week's dedicated issue post, when one exists */
  issue?: T;
  /** Every other post published that week, newest first */
  posts: T[];
}

/** Monday (yyyy-MM-dd) of the week containing `date`, evaluated in `timeZone`. */
export function weekStartOf(date: Date, timeZone: string): string {
  const [year, month, day, weekday] = formatInTimeZone(date, timeZone, 'yyyy-MM-dd-i').split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - (weekday - 1))).toISOString().slice(0, 10);
}

/**
 * Group posts into weeks, newest week first. In each week the newest post matching
 * `isIssue` leads as that week's issue; the remaining posts follow it.
 */
export function groupPostsByWeek<T extends { date: Date }>(
  posts: readonly T[],
  isIssue: (post: T) => boolean,
  timeZone: string,
): WeekGroup<T>[] {
  const weeks = new Map<string, WeekGroup<T>>();
  const newestFirst = [...posts].sort((a, b) => b.date.getTime() - a.date.getTime());

  for (const post of newestFirst) {
    const weekStart = weekStartOf(post.date, timeZone);
    let week = weeks.get(weekStart);
    if (!week) {
      week = { weekStart, posts: [] };
      weeks.set(weekStart, week);
    }
    if (!week.issue && isIssue(post)) week.issue = post;
    else week.posts.push(post);
  }

  // Posts were visited newest first, so Map insertion order is already newest week first.
  return [...weeks.values()];
}
