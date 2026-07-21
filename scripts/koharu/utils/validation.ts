import fs from 'node:fs';
import path from 'node:path';

import { BACKUP_DIR, BACKUP_FILE_EXTENSION } from '../constants';

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function isPathWithinDir(targetPath: string, allowedDir: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedDir = path.resolve(allowedDir);
  return resolvedTarget.startsWith(`${resolvedDir}${path.sep}`) || resolvedTarget === resolvedDir;
}

/**
 * Internal implementation note.
 */
export function isPathWithinBackupDir(targetPath: string): boolean {
  return isPathWithinDir(targetPath, BACKUP_DIR);
}

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function isValidBackupFile(filePath: string): boolean {
  // Internal implementation note.
  if (!filePath.endsWith(BACKUP_FILE_EXTENSION)) {
    return false;
  }

  // Internal implementation note.
  if (!fs.existsSync(filePath)) {
    return false;
  }

  // Internal implementation note.
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function validateBackupFilePath(filePath: string): string {
  const resolved = path.resolve(filePath);

  if (!isPathWithinBackupDir(resolved)) {
    throw new Error(`Backup file is not inside backup directory: ${filePath}`);
  }

  if (!isValidBackupFile(resolved)) {
    throw new Error(`Invalid backup file: ${filePath}`);
  }

  return resolved;
}

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function validatePathInBackupDir(filePath: string): string {
  const resolved = path.resolve(filePath);

  if (!isPathWithinBackupDir(resolved)) {
    throw new Error(`Path is not inside backup directory: ${filePath}`);
  }

  return resolved;
}
