import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupPostsByWeek, weekStartOf } from './weekly-digest';

const TZ = 'Asia/Kolkata';
const post = (slug: string, iso: string, issue = false) => ({ slug, date: new Date(iso), issue });

describe('weekStartOf', () => {
  it('returns the Monday of the week', () => {
    assert.equal(weekStartOf(new Date('2026-11-25T10:00:00+05:30'), TZ), '2026-11-23'); // Wednesday
    assert.equal(weekStartOf(new Date('2026-11-23T00:30:00+05:30'), TZ), '2026-11-23'); // Monday
    assert.equal(weekStartOf(new Date('2026-11-29T23:59:00+05:30'), TZ), '2026-11-23'); // Sunday
  });

  it('uses the site timezone, not UTC', () => {
    // Sunday 20:00 UTC is already Monday 01:30 in Kolkata.
    assert.equal(weekStartOf(new Date('2026-11-22T20:00:00Z'), TZ), '2026-11-23');
  });

  it('crosses month and year boundaries', () => {
    assert.equal(weekStartOf(new Date('2027-01-01T12:00:00+05:30'), TZ), '2026-12-28');
  });
});

describe('groupPostsByWeek', () => {
  const isIssue = (p: { issue: boolean }) => p.issue;

  it('groups newest week first with posts newest first', () => {
    const weeks = groupPostsByWeek(
      [post('a', '2026-11-16T10:00:00+05:30'), post('c', '2026-11-25T10:00:00+05:30'), post('b', '2026-11-24T10:00:00+05:30')],
      isIssue,
      TZ,
    );
    assert.deepEqual(
      weeks.map((w) => [w.weekStart, w.posts.map((p) => p.slug)]),
      [
        ['2026-11-23', ['c', 'b']],
        ['2026-11-16', ['a']],
      ],
    );
  });

  it('pulls the newest issue post out to lead its week', () => {
    const [week] = groupPostsByWeek(
      [
        post('old-issue', '2026-11-23T09:00:00+05:30', true),
        post('x', '2026-11-24T10:00:00+05:30'),
        post('issue', '2026-11-26T10:00:00+05:30', true),
      ],
      isIssue,
      TZ,
    );
    assert.equal(week.issue?.slug, 'issue');
    assert.deepEqual(
      week.posts.map((p) => p.slug),
      ['x', 'old-issue'],
    );
  });

  it('leaves issue undefined for weeks without one', () => {
    const [week] = groupPostsByWeek([post('x', '2026-11-24T10:00:00+05:30')], isIssue, TZ);
    assert.equal(week.issue, undefined);
  });

  it('returns no weeks for no posts', () => {
    assert.deepEqual(groupPostsByWeek([], isIssue, TZ), []);
  });
});
