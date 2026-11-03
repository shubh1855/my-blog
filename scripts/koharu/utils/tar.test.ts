import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { tarCreate, tarExtractManifest } from './tar';

for (const member of ['./manifest.json', 'manifest.json', 'nested/manifest.json']) {
  test(`manifest extraction handles archive member ${member}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koharu-tar-manifest-'));
    try {
      const stage = path.join(root, 'stage');
      const archive = path.join(root, 'backup.tar.gz');
      const manifestPath = path.join(stage, member);
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      const manifest = JSON.stringify({ name: 'manifest regression fixture' });
      fs.writeFileSync(manifestPath, manifest);

      if (member === './manifest.json') {
        tarCreate(archive, stage);
      } else {
        const result = spawnSync('tar', ['-czf', archive, '-C', stage, member]);
        assert.equal(result.status, 0, result.stderr?.toString());
      }

      assert.equal(tarExtractManifest(archive), member.startsWith('nested/') ? null : manifest);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
