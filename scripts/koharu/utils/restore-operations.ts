import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type BackupItem, DEFAULT_WORKSPACE, type KoharuWorkspace } from '../constants';
import { type ContentMigrationPlan, runContentMigration } from './migration-operations';
import { tarExtract } from './tar';
import { type ValidatedBackupArchive, withValidatedBackupArchiveSnapshot } from './validation';

/** Restore preview items */

export interface RestorePreviewItem {
  /** Target path (e.g., 'src/content/blog') */

  path: string;
  /** Number of files */

  fileCount: number;
  /** Existing files that will be removed before the archive is copied. */
  deletedFiles: string[];
}

export interface RestorePreview {
  items: RestorePreviewItem[];
  migration: ContentMigrationPlan | null;
}

export interface RestoreOutput {
  restoredFiles: string[];
  migration: ContentMigrationPlan | null;
}

export interface RestoreOptions {
  /** The target workspace to restore, defaulting to the current project */

  workspace?: KoharuWorkspace;
}

interface RestoreItemPaths {
  item: BackupItem;
  srcPath: string;
  destPath: string;
  candidatePath?: string;
}

interface RestoreCommitState extends RestoreItemPaths {
  candidatePath: string;
  previousPath: string;
  previousMoved: boolean;
  candidateInstalled: boolean;
}

class RestoreRollbackError extends AggregateError {
  readonly preserveTransaction = true;
}

function isPathWithin(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
  );
}

function resolveSafeRestoreTarget(projectRoot: string, relativeTarget: string): string {
  const rootPath = path.resolve(projectRoot);
  const rootStat = fs.lstatSync(rootPath, { throwIfNoEntry: false });
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Restore target root invalid or symlink: ${rootPath}`);
  }

  const destPath = path.resolve(rootPath, relativeTarget);
  if (!isPathWithin(rootPath, destPath)) {
    throw new Error(`Restore target out of project root: ${relativeTarget}`);
  }

  const realRoot = fs.realpathSync(rootPath);
  let currentPath = rootPath;
  for (const segment of path.relative(rootPath, destPath).split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment);
    const stat = fs.lstatSync(currentPath, { throwIfNoEntry: false });
    if (!stat) break;
    if (stat.isSymbolicLink()) {
      throw new Error(`Restore target path contains symlink: ${path.relative(rootPath, currentPath)}`);
    }
    if (!isPathWithin(realRoot, fs.realpathSync(currentPath))) {
      throw new Error(`Restore target real path out of project root: ${path.relative(rootPath, currentPath)}`);
    }
  }

  return destPath;
}

function assertArchiveItemMatchesContract(item: BackupItem, itemPath: string): void {
  const stat = fs.lstatSync(itemPath);
  if (stat.isSymbolicLink()) {
    throw new Error(`Backup content contains symlink: ${itemPath}`);
  }

  const matchesExpectedType = item.kind === 'directory' ? stat.isDirectory() : stat.isFile();
  if (!matchesExpectedType) {
    const expected = item.kind === 'directory' ? 'directory' : 'regular file';
    throw new Error(`Backup item ${item.dest} type invalid, should be ${expected}`);
  }

  if (!stat.isDirectory()) return;

  for (const entry of fs.readdirSync(itemPath)) {
    assertArchiveTreeContainsOnlyFilesAndDirectories(path.join(itemPath, entry));
  }
}

function assertArchiveTreeContainsOnlyFilesAndDirectories(itemPath: string): void {
  const stat = fs.lstatSync(itemPath);
  if (stat.isSymbolicLink()) {
    throw new Error(`Backup content contains symlink: ${itemPath}`);
  }
  if (stat.isFile()) return;
  if (!stat.isDirectory()) {
    throw new Error(`Backup content contains unsupported file type: ${itemPath}`);
  }

  for (const entry of fs.readdirSync(itemPath)) {
    assertArchiveTreeContainsOnlyFilesAndDirectories(path.join(itemPath, entry));
  }
}

function assertCopyDestinationsAreSafe(projectRoot: string, sourcePath: string, relativeTarget: string): void {
  resolveSafeRestoreTarget(projectRoot, relativeTarget);
  if (!fs.lstatSync(sourcePath).isDirectory()) return;

  for (const entry of fs.readdirSync(sourcePath)) {
    assertCopyDestinationsAreSafe(projectRoot, path.join(sourcePath, entry), path.join(relativeTarget, entry));
  }
}

function listFiles(rootPath: string): string[] {
  const stat = fs.lstatSync(rootPath, { throwIfNoEntry: false });
  if (!stat) return [];
  if (!stat.isDirectory()) return [rootPath];

  return fs.readdirSync(rootPath).flatMap((entry) => listFiles(path.join(rootPath, entry)));
}

function getPresentRestoreItems(validated: ValidatedBackupArchive): BackupItem[] {
  const presentItems = validated.items.filter((item) => validated.manifest.files[item.dest]);
  return presentItems.filter(
    (item) =>
      !presentItems.some(
        (parent) =>
          parent !== item &&
          parent.kind === 'directory' &&
          isPathWithin(path.resolve('/', parent.src), path.resolve('/', item.src)),
      ),
  );
}

function getFilesRemovedBeforeRestore(item: BackupItem, destPath: string): string[] {
  const stat = fs.lstatSync(destPath, { throwIfNoEntry: false });
  if (!stat) return [];
  if (item.replaceOnRestore) return listFiles(destPath);
  if (!item.pattern || !stat.isDirectory()) return [];

  const extension = item.pattern.startsWith('*.') ? item.pattern.slice(1) : null;
  return fs
    .readdirSync(destPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (!extension || entry.name.endsWith(extension)))
    .map((entry) => path.join(destPath, entry.name));
}

function prepareRestoreTarget(item: BackupItem, destPath: string): void {
  const stat = fs.lstatSync(destPath, { throwIfNoEntry: false });
  if (!stat) return;

  if (item.replaceOnRestore) {
    fs.rmSync(destPath, { recursive: true, force: true });
    return;
  }

  if (item.pattern && stat.isDirectory()) {
    const extension = item.pattern.startsWith('*.') ? item.pattern.slice(1) : null;
    for (const entry of fs.readdirSync(destPath, { withFileTypes: true })) {
      if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
        fs.rmSync(path.join(destPath, entry.name), { force: true });
      }
    }
  }
}

function createRestoreCandidate(
  transactionDir: string,
  restoreItem: RestoreItemPaths,
): RestoreItemPaths & { candidatePath: string } {
  const { item, srcPath, destPath } = restoreItem;
  const candidatePath = path.join(transactionDir, 'next', item.dest);
  const existingStat = fs.lstatSync(destPath, { throwIfNoEntry: false });

  fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
  if (!item.replaceOnRestore && existingStat) {
    fs.cpSync(destPath, candidatePath, { recursive: true });
    prepareRestoreTarget(item, candidatePath);
  }
  fs.cpSync(srcPath, candidatePath, { recursive: true });

  return { ...restoreItem, candidatePath };
}

function rollbackRestoreCommit(states: RestoreCommitState[]): Error[] {
  const rollbackErrors: Error[] = [];
  for (const state of states.toReversed()) {
    try {
      if (state.candidateInstalled) {
        fs.rmSync(state.destPath, { recursive: true, force: true });
      }
      if (state.previousMoved) {
        fs.mkdirSync(path.dirname(state.destPath), { recursive: true });
        fs.renameSync(state.previousPath, state.destPath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rollbackErrors.push(new Error(`${state.item.src}: ${message}`));
    }
  }
  return rollbackErrors;
}

function commitRestoreCandidates(
  transactionDir: string,
  candidates: Array<RestoreItemPaths & { candidatePath: string }>,
): void {
  const states: RestoreCommitState[] = [];

  try {
    for (const candidate of candidates) {
      const previousPath = path.join(transactionDir, 'previous', candidate.item.dest);
      const state: RestoreCommitState = {
        ...candidate,
        previousPath,
        previousMoved: false,
        candidateInstalled: false,
      };
      states.push(state);

      fs.mkdirSync(path.dirname(candidate.destPath), { recursive: true });
      if (fs.lstatSync(candidate.destPath, { throwIfNoEntry: false })) {
        fs.mkdirSync(path.dirname(previousPath), { recursive: true });
        fs.renameSync(candidate.destPath, previousPath);
        state.previousMoved = true;
      }

      fs.renameSync(candidate.candidatePath, candidate.destPath);
      state.candidateInstalled = true;
    }
  } catch (commitError) {
    const rollbackErrors = rollbackRestoreCommit(states);
    if (rollbackErrors.length === 0) throw commitError;

    const commitMessage = commitError instanceof Error ? commitError.message : String(commitError);
    throw new RestoreRollbackError(
      [commitError, ...rollbackErrors],
      `Restore commit failed: ${commitMessage}; Rollback failed: ${rollbackErrors.map((error) => error.message).join('; ')}; Transaction data kept at ${transactionDir}`,
    );
  }
}

function previewRestoredContentMigration(tempDir: string, projectRoot: string): ContentMigrationPlan | null {
  const archivedContent = path.join(tempDir, 'content/blog');
  if (!fs.existsSync(archivedContent)) return null;

  const projectionRoot = path.join(tempDir, '.restore-preview');
  const projectedContent = path.join(projectionRoot, 'src/content/blog');
  const projectedConfig = path.join(projectionRoot, 'config/site.yaml');
  fs.mkdirSync(path.dirname(projectedContent), { recursive: true });
  fs.cpSync(archivedContent, projectedContent, { recursive: true });

  const archivedConfig = path.join(tempDir, 'config/site.yaml');
  const currentConfig = resolveSafeRestoreTarget(projectRoot, 'config/site.yaml');
  const finalConfig = fs.existsSync(archivedConfig) ? archivedConfig : currentConfig;
  if (fs.existsSync(finalConfig)) {
    fs.mkdirSync(path.dirname(projectedConfig), { recursive: true });
    fs.copyFileSync(finalConfig, projectedConfig);
  }

  return runContentMigration({ contentDir: projectedContent, siteConfigPath: projectedConfig, dryRun: true });
}

function extractValidatedBackupSnapshot(backupPath: string, tempDir: string, backupDir: string): ValidatedBackupArchive {
  return withValidatedBackupArchiveSnapshot(
    backupPath,
    (validated) => {
      tarExtract(validated.path, tempDir);
      return { ...validated, path: path.resolve(backupPath) };
    },
    backupDir,
  );
}

/**
 * Preview a restore without modifying any files.
 * @param backupPath Backup archive path.
 * @returns Preview of the files to restore and delete, plus the content migration plan.
 */
export function getRestorePreview(backupPath: string, options: RestoreOptions = {}): RestorePreview {
  const workspace = options.workspace ?? DEFAULT_WORKSPACE;
  const projectRoot = workspace.root;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-koharu-restore-preview-'));

  try {
    const validated = extractValidatedBackupSnapshot(backupPath, tempDir, workspace.backupDir);
    const items: RestorePreviewItem[] = [];

    for (const item of getPresentRestoreItems(validated)) {
      const srcPath = path.join(tempDir, item.dest);
      if (!fs.existsSync(srcPath)) continue;

      assertArchiveItemMatchesContract(item, srcPath);
      assertCopyDestinationsAreSafe(projectRoot, srcPath, item.src);
      const destPath = resolveSafeRestoreTarget(projectRoot, item.src);
      const deletedFiles = getFilesRemovedBeforeRestore(item, destPath).map((file) =>
        path.relative(projectRoot, file).replaceAll(path.sep, '/'),
      );
      const fileCount = listFiles(srcPath).length;
      items.push({ path: item.src, fileCount: fileCount || 1, deletedFiles });
    }

    return { items, migration: previewRestoredContentMigration(tempDir, projectRoot) };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Restore a backup archive transactionally.
 * @param backupPath Backup archive path.
 * @returns The restored target paths and the content migration plan that ran.
 */
export function restoreBackup(backupPath: string, options: RestoreOptions = {}): RestoreOutput {
  const workspace = options.workspace ?? DEFAULT_WORKSPACE;
  const projectRoot = workspace.root;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-koharu-restore-'));
  let transactionDir: string | null = null;
  let preserveTransaction = false;

  try {
    const validated = extractValidatedBackupSnapshot(backupPath, tempDir, workspace.backupDir);

    const restoreItems: RestoreItemPaths[] = getPresentRestoreItems(validated).flatMap((item) => {
      const srcPath = path.join(tempDir, item.dest);
      if (!fs.existsSync(srcPath)) return [];
      assertArchiveItemMatchesContract(item, srcPath);
      assertCopyDestinationsAreSafe(projectRoot, srcPath, item.src);
      return [{ item, srcPath, destPath: resolveSafeRestoreTarget(projectRoot, item.src) }];
    });
    if (restoreItems.length === 0) return { restoredFiles: [], migration: null };

    const activeTransactionDir = fs.mkdtempSync(path.join(projectRoot, '.koharu-restore-'));
    transactionDir = activeTransactionDir;
    fs.chmodSync(activeTransactionDir, 0o700);
    const candidates = restoreItems.map((restoreItem) => createRestoreCandidate(activeTransactionDir, restoreItem));
    const contentCandidate = candidates.find((candidate) => candidate.item.src === 'src/content/blog');
    const configCandidate = candidates.find(
      (candidate) => candidate.item.src === 'config' || candidate.item.src === 'config/site.yaml',
    );
    const migration = contentCandidate
      ? runContentMigration({
          contentDir: contentCandidate.candidatePath,
          siteConfigPath: configCandidate
            ? configCandidate.item.kind === 'directory'
              ? path.join(configCandidate.candidatePath, 'site.yaml')
              : configCandidate.candidatePath
            : resolveSafeRestoreTarget(projectRoot, 'config/site.yaml'),
        })
      : null;
    if (migration && migration.errors.length > 0) {
      throw new Error(`Restore content migration has ${migration.errors.length} errors, no files modified`);
    }

    for (const candidate of candidates) {
      resolveSafeRestoreTarget(projectRoot, candidate.item.src);
    }
    commitRestoreCandidates(activeTransactionDir, candidates);
    return { restoredFiles: restoreItems.map(({ item }) => item.src), migration };
  } catch (error) {
    preserveTransaction = error instanceof RestoreRollbackError && error.preserveTransaction;
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (transactionDir && !preserveTransaction) {
      fs.rmSync(transactionDir, { recursive: true, force: true });
    }
  }
}
