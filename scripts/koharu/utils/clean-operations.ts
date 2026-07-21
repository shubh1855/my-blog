import fs from 'node:fs';

import { isValidBackupFile, validatePathInBackupDir } from './validation';

/**
 * Internal implementation note.
 */
export interface DeleteResult {
  deletedCount: number;
  freedSpace: number;
  skippedCount: number;
}

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function deleteBackups(paths: string[]): DeleteResult {
  let freedSpace = 0;
  let deletedCount = 0;
  let skippedCount = 0;

  for (const filePath of paths) {
    try {
      // Internal implementation note.
      const validatedPath = validatePathInBackupDir(filePath);

      if (!isValidBackupFile(validatedPath)) {
        skippedCount++;
        continue;
      }

      const stats = fs.statSync(validatedPath);
      freedSpace += stats.size;
      fs.unlinkSync(validatedPath);
      deletedCount++;
    } catch {
      skippedCount++;
    }
  }

  return { deletedCount, freedSpace, skippedCount };
}
