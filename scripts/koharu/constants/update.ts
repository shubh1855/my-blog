/** Upstream remote warehouse name */

export const UPSTREAM_REMOTE = 'upstream';

/** Upstream repository URL */

export const UPSTREAM_URL = 'https://github.com/cosZone/astro-koharu.git';

/** GitHub repository path (for API calls) */

export const GITHUB_REPO = 'cosZone/astro-koharu';

/** master branch name */

export const MAIN_BRANCH = 'main';

/** A single git invocation planned by the policy layer and run by the porcelain layer. */
export interface GitCommand {
  /** Arguments passed to `git`, already quoted. */
  args: string;
  /** Run through the non-throwing porcelain helper. */
  safe?: boolean;
}

/** Commit information */

export interface CommitInfo {
  hash: string;
  message: string;
  date: string;
  author: string;
}

/** Git status information */

export interface GitStatusInfo {
  /** current branch */

  currentBranch: string;
  /** Is the work area clean? */

  isClean: boolean;
  /** Number of uncommitted files */

  uncommittedCount: number;
  /** List of unstaged files */

  uncommittedFiles: string[];
}

/** Update status information */

export interface UpdateInfo {
  /** Whether Already configure upstream */

  hasUpstream: boolean;
  /** Number of commits local is behind upstream */

  behindCount: number;
  /** The number of local commits ahead of upstream */

  aheadCount: number;
  /** New commit list (new commits when upgrading, commits removed by Will when downgrading) */

  commits: CommitInfo[];
  /** Local leading commit list (commits that will be replayed during rebase) */

  localCommits: CommitInfo[];
  /** Current version */

  currentVersion: string;
  /** latest version (or target version) */

  latestVersion: string;
  /** Is it a downgrade operation? */

  isDowngrade: boolean;
}

/** Merge results */

export interface MergeResult {
  success: boolean;
  /** Is there any conflict? */

  hasConflict: boolean;
  /** Conflict file list */

  conflictFiles: string[];
  /** error message */

  error?: string;
  /** Is it a rebase conflict? */

  isRebaseConflict?: boolean;
  /** Automatically resolved user content conflict files */

  autoResolvedFiles?: string[];
  /** Commit SHA before clean mode merge (used for rollback when restore fails) */

  preCleanSha?: string;
}

/** GitHub Release information */

export interface ReleaseInfo {
  /** Tag name, such as "v2.2.0" */

  tagName: string;
  /** Release page URL */

  url: string;
  /** Release Notes (Markdown) */
  body: string | null;
}

// ============ State machine type ============

/** Update process status */

export type UpdateStatus =
  | 'checking' // Check Git status
  | 'dirty-warning' // There are uncommitted changes in the workspace
  | 'backup-confirm' // Confirm backup
  | 'backing-up' // Backing up
  | 'fetching' // Get Update
  | 'preview' // Show Update preview
  | 'merging' // merging
  | 'clean-restoring' // clean mode restores user content
  | 'installing' // Installing dependencies
  | 'done' // Done
  | 'conflict' // There is a conflict
  | 'up-to-date' // Already is the latest
  | 'error'; // Error

/** Update process configuration options */

export interface UpdateOptions {
  checkOnly: boolean;
  skipBackup: boolean;
  force: boolean;
  /** Specify the target version tag to update to (such as "v2.1.0" or "2.1.0") */

  targetTag?: string;
  /** Use rebase mode (rewrite history) */

  rebase: boolean;
  /** Preview operation (without actual execution) */

  dryRun: boolean;
  /** Use clean mode (replaces all theme files, restores user content) */

  clean: boolean;
}

/** State machine State */

export interface UpdateState {
  status: UpdateStatus;
  gitStatus: GitStatusInfo | null;
  /** The exact pnpm version captured from the current package.json when Update starts */

  packageManager: string;
  updateInfo: UpdateInfo | null;
  mergeResult: MergeResult | null;
  backupFile: string;
  error: string;
  /** Non-main branch warning information */

  branchWarning: string;
  options: UpdateOptions;
  /** Sign of first migration from squash merge to regular merge */

  needsMigration: boolean;
  /** List of file paths restored in Clean mode */

  restoredFiles: string[];
}

/** State Machine Action */

export type UpdateAction =
  | { type: 'GIT_CHECKED'; payload: GitStatusInfo; packageManager: string }
  | { type: 'FETCHED'; payload: UpdateInfo; needsMigration?: boolean }
  | { type: 'BACKUP_CONFIRM' }
  | { type: 'BACKUP_SKIP' }
  | { type: 'BACKUP_DONE'; backupFile: string }
  | { type: 'UPDATE_CONFIRM' }
  | { type: 'MERGED'; payload: MergeResult }
  | { type: 'CLEAN_RESTORED'; restoredFiles: string[] }
  | { type: 'INSTALLED' }
  | { type: 'ERROR'; error: string };
