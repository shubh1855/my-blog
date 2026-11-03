import assert from 'node:assert/strict';
import test from 'node:test';
import { getCategoryLinks, getCategorySlug } from './category-url';

test('category paths preserve configured aliases and nested hierarchy URLs', () => {
  const mapping = { Notes: 'note', Frontend: 'front-end' };
  assert.equal(getCategorySlug('Notes', mapping), 'note');
  assert.equal(
    `/categories/${['Notes', 'Frontend'].map((name) => getCategorySlug(name, mapping)).join('/')}`,
    '/categories/note/front-end',
  );
  assert.deepEqual(getCategoryLinks([{ name: 'Notes', children: [{ name: 'Frontend' }] }], '', mapping), [
    'note',
    'note/front-end',
  ]);
});

test('category paths fail clearly for missing and blank slug mappings', () => {
  assert.throws(() => getCategorySlug('KPMG CTF 2026', {}), /Missing URL slug mapping.*KPMG CTF 2026/);
  assert.throws(() => getCategorySlug('Tools', { Tools: '   ' }), /Missing URL slug mapping.*Tools/);
});

test('category link generation rejects actual path collisions but allows repeated slugs under different parents', () => {
  assert.throws(
    () => getCategoryLinks([{ name: 'Alpha' }, { name: 'Beta' }], '', { Alpha: 'same', Beta: 'same' }),
    /Duplicate category URL "\/categories\/same".*Alpha.*Beta/,
  );

  assert.deepEqual(
    getCategoryLinks(
      [
        { name: 'Alpha', children: [{ name: 'Shared' }] },
        { name: 'Beta', children: [{ name: 'Shared' }] },
      ],
      '',
      { Alpha: 'alpha', Beta: 'beta', Shared: 'shared' },
    ),
    ['alpha', 'alpha/shared', 'beta', 'beta/shared'],
  );
});
