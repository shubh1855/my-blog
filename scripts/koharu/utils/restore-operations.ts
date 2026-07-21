import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PROJECT_ROOT, RESTORE_MAP } from '../constants';
import { tarExtract, tarList } from './tar';
import { validateBackupFilePath } from './validation';

/** Internal implementation note. */
export interface RestorePreviewItem {
  /** Internal implementation note. */
  path: string;
  /** Internal implementation note. */
  fileCount: number;
}

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function getRestorePreview(backupPath: string): RestorePreviewItem[] {
  // Internal implementation note.
  const validatedPath = validateBackupFilePath(backupPath);

  const rawFiles = tarList(validatedPath);
  // Internal implementation note.
  const files = rawFiles.map((f) => f.replace(/^\.\//, '').replace(/\/$/, '')).filter((f) => f && f !== 'manifest.json');

  const previewItems: RestorePreviewItem[] = [];

  for (const [src, dest] of Object.entries(RESTORE_MAP)) {
    // Internal implementation note.
    const matchingFiles = files.filter((f) => f === src || f.startsWith(`${src}/`));

    if (matchingFiles.length > 0) {
      // Internal implementation note.
      const fileCount = matchingFiles.filter((f) => f !== src).length;
      previewItems.push({ path: dest, fileCount: fileCount || 1 });
    }
  }

  return previewItems;
}

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function restoreBackup(backupPath: string): string[] {
  // Internal implementation note.
  const validatedPath = validateBackupFilePath(backupPath);

  // Internal implementation note.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-koharu-restore-'));

  try {
    // Internal implementation note.
    tarExtract(validatedPath, tempDir);

    const restored: string[] = [];

    // Internal implementation note.
    for (const [src, dest] of Object.entries(RESTORE_MAP)) {
      const srcPath = path.join(tempDir, src);
      const destPath = path.join(PROJECT_ROOT, dest);

      if (fs.existsSync(srcPath)) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.cpSync(srcPath, destPath, { recursive: true });
        restored.push(dest);
      }
    }

    return restored;
  } finally {
    // Internal implementation note.
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
