import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFilterText, matchesFilterTokens, normalizeFilterText, tokenizeFilterQuery } from './list-filter';

describe('normalizeFilterText', () => {
  it('lower-cases, strips diacritics and collapses whitespace', () => {
    assert.equal(normalizeFilterText('  Café   SQL\tInjection '), 'cafe sql injection');
  });

  it('keeps CJK text intact', () => {
    assert.equal(normalizeFilterText('笔记 前端'), '笔记 前端');
  });
});

describe('tokenizeFilterQuery', () => {
  it('returns no tokens for blank input', () => {
    assert.deepEqual(tokenizeFilterQuery('   '), []);
  });

  it('de-duplicates tokens', () => {
    assert.deepEqual(tokenizeFilterQuery('XSS xss  web'), ['xss', 'web']);
  });
});

describe('matchesFilterTokens', () => {
  const text = buildFilterText('AcmeBank Login Bypass', ['web', 'SQLi'], 'KPMG CTF 2026');

  it('matches everything with no tokens', () => {
    assert.equal(matchesFilterTokens(text, []), true);
  });

  it('requires every token, in any order', () => {
    assert.equal(matchesFilterTokens(text, tokenizeFilterQuery('sqli acme')), true);
    assert.equal(matchesFilterTokens(text, tokenizeFilterQuery('sqli linux')), false);
  });

  it('matches partial words', () => {
    assert.equal(matchesFilterTokens(text, tokenizeFilterQuery('bypa')), true);
  });
});

describe('buildFilterText', () => {
  it('flattens arrays and skips empty values', () => {
    assert.equal(buildFilterText('Title', ['a', 'B'], undefined, null, ''), 'title a b');
  });
});
