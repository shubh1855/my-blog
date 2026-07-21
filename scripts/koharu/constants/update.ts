/** Internal implementation note. */
export const UPSTREAM_REMOTE = 'upstream';

/** Internal implementation note. */
export const UPSTREAM_URL = 'https://github.com/cosZone/astro-koharu.git';

/** Internal implementation note. */
export const GITHUB_REPO = 'cosZone/astro-koharu';

/** Internal implementation note. */
export const MAIN_BRANCH = 'main';

/** Internal implementation note. */
export interface CommitInfo {
  hash: string;
  message: string;
  date: string;
  author: string;
}

/** Internal implementation note. */
export interface GitStatusInfo {
  /** Internal implementation note. */
  currentBranch: string;
  /** Internal implementation note. */
  isClean: boolean;
  /** Internal implementation note. */
  uncommittedCount: number;
  /** Internal implementation note. */
  uncommittedFiles: string[];
}

/** Internal implementation note. */
export interface UpdateInfo {
  /** Internal implementation note. */
  hasUpstream: boolean;
  /** Internal implementation note. */
  behindCount: number;
  /** Internal implementation note. */
  aheadCount: number;
  /** Internal implementation note. */
  commits: CommitInfo[];
  /** Internal implementation note. */
  localCommits: CommitInfo[];
  /** Internal implementation note. */
  currentVersion: string;
  /** Internal implementation note. */
  latestVersion: string;
  /** Internal implementation note. */
  isDowngrade: boolean;
}

/** Internal implementation note. */
export interface MergeResult {
  success: boolean;
  /** Internal implementation note. */
  hasConflict: boolean;
  /** Internal implementation note. */
  conflictFiles: string[];
  /** Internal implementation note. */
  error?: string;
  /** Internal implementation note. */
  isRebaseConflict?: boolean;
  /** Internal implementation note. */
  autoResolvedFiles?: string[];
  /** Internal implementation note. */
  preCleanSha?: string;
}

/** Internal implementation note. */
export interface ReleaseInfo {
  /** Internal implementation note. */
  tagName: string;
  /** Internal implementation note. */
  url: string;
  /** Release Notes (Markdown) */
  body: string | null;
}

// Internal implementation note.

/** Internal implementation note. */
export type UpdateStatus =
  | 'checking' // checking Git status
  | 'dirty-warning' // working tree has uncommitted changes
  | 'backup-confirm' // confirm backup
  | 'backing-up' // backing up
  | 'fetching' // fetching updates
  | 'preview' // show update preview
  | 'merging' // merging
  | 'clean-restoring' // clean mode restoring user content
  | 'installing' // install dependencies
  | 'done' // done
  | 'conflict' // has conflicts
  | 'up-to-date' // up to date
  | 'error'; // error

/** Internal implementation note. */
export interface UpdateOptions {
  checkOnly: boolean;
  skipBackup: boolean;
  force: boolean;
  /** Internal implementation note. */
  targetTag?: string;
  /** Internal implementation note. */
  rebase: boolean;
  /** Preview operation (do not execute) */
  dryRun: boolean;
  /** Internal implementation note. */
  clean: boolean;
}

/** Internal implementation note. */
export interface UpdateState {
  status: UpdateStatus;
  gitStatus: GitStatusInfo | null;
  updateInfo: UpdateInfo | null;
  mergeResult: MergeResult | null;
  backupFile: string;
  error: string;
  /** Internal implementation note. */
  branchWarning: string;
  options: UpdateOptions;
  /** Internal implementation note. */
  needsMigration: boolean;
  /** Internal implementation note. */
  restoredFiles: string[];
}

/** Internal implementation note. */
export type UpdateAction =
  | { type: 'GIT_CHECKED'; payload: GitStatusInfo }
  | { type: 'FETCHED'; payload: UpdateInfo; needsMigration?: boolean }
  | { type: 'BACKUP_CONFIRM' }
  | { type: 'BACKUP_SKIP' }
  | { type: 'BACKUP_DONE'; backupFile: string }
  | { type: 'UPDATE_CONFIRM' }
  | { type: 'MERGED'; payload: MergeResult }
  | { type: 'CLEAN_RESTORED'; restoredFiles: string[] }
  | { type: 'INSTALLED' }
  | { type: 'ERROR'; error: string };
