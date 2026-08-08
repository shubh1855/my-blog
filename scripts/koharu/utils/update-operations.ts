import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { USER_CONTENT_PREFIXES } from '../constants/backup';
import { PACKAGE_JSON_PATH, PROJECT_ROOT } from '../constants/paths';
import {
  type GitStatusInfo,
  MAIN_BRANCH,
  type MergeResult,
  UPSTREAM_REMOTE,
  UPSTREAM_URL,
  type UpdateInfo,
} from '../constants/update';
import {
  addRemote,
  fetchRemote,
  getCurrentBranch,
  getHeadSha,
  getRemoteUrl,
  getStatusLines,
  git,
  gitSafe,
  hasRef,
  keepOursAndStage,
  normalizeRemoteUrl,
  parseGitLines,
  runGitCommands,
  showFile,
} from './git-porcelain';
import {
  decideDowngrade,
  normalizeTag,
  parseCommits,
  parseConflictStatusLines,
  parseRevListCounts,
  planCleanFinalizeCommands,
  planCleanRemovals,
  planConflictResolution,
  planDowngradeCommit,
  planStrategyCommands,
  resolveConflictOutcome,
  resolveTargetRef,
  selectUpdateStrategy,
} from './update-policy';
import { getVersion } from './version';

/**
 * Executor for the update flow: it reads repository state through
 * `git-porcelain.ts`, asks `update-policy.ts` what to do, and runs the result.
 */

export interface PackageManagerInstallCommand {
  command: string;
  args: string[];
}

function parsePackageManager(packageManager: unknown): string {
  if (typeof packageManager !== 'string' || !/^pnpm@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageManager)) {
    throw new Error('package.json must declare exact packageManager, e.g. pnpm@10.28.2');
  }

  return packageManager;
}

/** Build an install command that cannot fall back to the caller's older pnpm binary. */
export function getPackageManagerInstallCommand(
  packageManager: unknown,
  fallbackPackageManager?: unknown,
): PackageManagerInstallCommand {
  const exactPackageManager = parsePackageManager(packageManager === undefined ? fallbackPackageManager : packageManager);

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['--yes', exactPackageManager, 'install'],
  };
}

/** Read the pnpm pin before an update can replace package.json with a legacy version. */
export function readProjectPackageManager(): string {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { packageManager?: unknown };
  return parsePackageManager(packageJson.packageManager);
}

export interface EnsureUpstreamOptions {
  allowAdd?: boolean;
}

export interface EnsureUpstreamResult {
  existed: boolean;
  success: boolean;
  reason?: 'mismatch' | 'missing' | 'add-failed';
  currentUrl?: string;
}

/**
 * Check Git status
 */
export function checkGitStatus(): GitStatusInfo {
  const currentBranch = getCurrentBranch();
  const uncommittedFiles = getStatusLines();

  return {
    currentBranch,
    isClean: uncommittedFiles.length === 0,
    uncommittedCount: uncommittedFiles.length,
    uncommittedFiles: uncommittedFiles.map((line) => line.slice(3)), // Remove status prefix
  };
}

export function hasUpstreamRemote(): boolean {
  return Boolean(getRemoteUrl(UPSTREAM_REMOTE));
}

export function hasUpstreamTrackingRef(): boolean {
  return hasRef(`refs/remotes/${UPSTREAM_REMOTE}/${MAIN_BRANCH}`);
}

export function getUpstreamRemoteUrl(): string | null {
  return getRemoteUrl(UPSTREAM_REMOTE);
}

export function addUpstreamRemote(): boolean {
  return addRemote(UPSTREAM_REMOTE, UPSTREAM_URL);
}

/**
 * Make sure upstream remote Already is configured
 */
export function ensureUpstreamRemote(options: EnsureUpstreamOptions = {}): EnsureUpstreamResult {
  const allowAdd = options.allowAdd ?? true;
  const currentUrl = getUpstreamRemoteUrl();
  if (currentUrl) {
    if (normalizeRemoteUrl(UPSTREAM_URL) !== normalizeRemoteUrl(currentUrl)) {
      return { existed: true, success: false, reason: 'mismatch', currentUrl };
    }
    return { existed: true, success: true, currentUrl };
  }
  if (!allowAdd) {
    return { existed: false, success: false, reason: 'missing' };
  }
  const success = addUpstreamRemote();
  return success ? { existed: false, success: true } : { existed: false, success: false, reason: 'add-failed' };
}

export function fetchUpstream(): boolean {
  return fetchRemote(UPSTREAM_REMOTE);
}

function readVersionFromRef(ref: string): string | null {
  const packageJsonContent = showFile(ref, 'package.json');
  if (!packageJsonContent) return null;
  try {
    const packageJson = JSON.parse(packageJsonContent);
    return typeof packageJson.version === 'string' ? packageJson.version : null;
  } catch {
    return null;
  }
}

/**
 * Get Update information
 * @param targetTag Optional target version tag, if not specified, Update to upstream/main
 */
export function getUpdateInfo(targetTag?: string): UpdateInfo {
  if (!hasUpstreamRemote()) {
    return {
      hasUpstream: false,
      behindCount: 0,
      aheadCount: 0,
      commits: [],
      localCommits: [],
      currentVersion: getVersion(),
      latestVersion: 'unknown',
      isDowngrade: false,
    };
  }

  const { normalizedTag, targetRef } = resolveTargetRef(targetTag);
  const { aheadCount, behindCount } = parseRevListCounts(gitSafe(`rev-list --left-right --count HEAD...${targetRef}`));
  const isDowngrade = decideDowngrade({ normalizedTag, aheadCount, behindCount });

  const commitFormat = '%h|%s|%ar|%an';
  // Downgrading lists Will's removed commits, upgrading lists new commits.
  const commitsRange = isDowngrade ? `${targetRef}..HEAD` : `HEAD..${targetRef}`;
  const commits = parseCommits(gitSafe(`log ${commitsRange} --pretty=format:"${commitFormat}" --no-merges`) || '');
  // Local commits ahead of target (will be replayed during rebase)
  const localCommits = parseCommits(gitSafe(`log ${targetRef}..HEAD --pretty=format:"${commitFormat}" --no-merges`) || '');

  const latestVersion = normalizedTag
    ? normalizedTag.replace(/^v/, '')
    : (readVersionFromRef(`${UPSTREAM_REMOTE}/${MAIN_BRANCH}`) ?? 'unknown');

  return {
    hasUpstream: true,
    behindCount,
    aheadCount,
    commits,
    localCommits,
    currentVersion: getVersion(),
    latestVersion,
    isDowngrade,
  };
}

/** Merge operation options */
export interface MergeOptions {
  /** Target version tag (such as "v2.1.0"), use upstream/main if not specified */

  targetTag?: string;
  /** Whether it is a downgrade operation, use checkout + commit to retain the history when downgrading */

  isDowngrade?: boolean;
  /** Use rebase mode: Will local commits be replayed on top of the target reference (rewrite history) */

  rebase?: boolean;
  /** Use clean mode: replace all theme files and later restore user content from backup */

  clean?: boolean;
}

/** Get target version info for commit message */
function getVersionInfo(targetRef: string, normalizedTag: string | null): string {
  if (normalizedTag) return normalizedTag;
  const version = readVersionFromRef(targetRef);
  return version ? `v${version}` : 'latest';
}

function getConflictFiles(): string[] {
  const diffFiles = parseGitLines(gitSafe('diff --name-only --diff-filter=U'));
  if (diffFiles.length > 0) return [...new Set(diffFiles)];
  return parseConflictStatusLines(getStatusLines());
}

/** Clean mode: delete non-user content files removed by upstream Already */

function removeDeletedUpstreamFiles(targetRef: string): void {
  const plan = planCleanRemovals({
    localFiles: parseGitLines(gitSafe('ls-files')),
    upstreamFiles: parseGitLines(gitSafe(`ls-tree -r --name-only ${targetRef}`)),
    userContentPrefixes: USER_CONTENT_PREFIXES,
  });
  runGitCommands(plan.commands);
}

/**
 * Perform a merge, downgrade, rebase or clean operation
 *
 * @param options - merge options
 * @returns merge results, including success status, conflict information, etc.
 */
export function mergeUpstream(options: MergeOptions = {}): MergeResult {
  const { normalizedTag, targetRef } = resolveTargetRef(options.targetTag);
  const strategy = selectUpdateStrategy({ normalizedTag, ...options });

  try {
    if (strategy === 'clean') {
      // Save the pre-merge SHA for rollback if restore fails
      const preCleanSha = getHeadSha();
      runGitCommands(
        planStrategyCommands(strategy, { targetRef, normalizedTag, versionInfo: getVersionInfo(targetRef, normalizedTag) }),
      );
      removeDeletedUpstreamFiles(targetRef);
      // Temporarily overwrites the file state (user content will be restored in the clean-restoring phase)
      runGitCommands(planCleanFinalizeCommands());
      return { success: true, hasConflict: false, conflictFiles: [], preCleanSha };
    }

    runGitCommands(
      planStrategyCommands(strategy, { targetRef, normalizedTag, versionInfo: getVersionInfo(targetRef, normalizedTag) }),
    );
    if (strategy === 'downgrade' && normalizedTag && getStatusLines().length > 0) {
      runGitCommands([planDowngradeCommit(normalizedTag)]);
    }

    return { success: true, hasConflict: false, conflictFiles: [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Downgrade does not leave a conflict state that can be resolved
    if (strategy === 'downgrade') {
      return { success: false, hasConflict: false, conflictFiles: [], error: errorMessage };
    }

    const conflictFiles = getConflictFiles();
    if (conflictFiles.length === 0) {
      return { success: false, hasConflict: false, conflictFiles: [], error: errorMessage };
    }

    const plan = planConflictResolution({ strategy, conflictFiles, userContentPrefixes: USER_CONTENT_PREFIXES });
    const failedFiles = plan.autoResolveFiles.filter((file) => !keepOursAndStage(file));
    const outcome = resolveConflictOutcome(plan, failedFiles);

    if (outcome.canCommit) {
      try {
        git('commit --no-edit');
        return {
          success: true,
          hasConflict: false,
          conflictFiles: [],
          autoResolvedFiles: outcome.autoResolvedFiles,
        };
      } catch {
        // Commit failed and still returned conflicts
      }
    }

    return {
      success: false,
      hasConflict: true,
      conflictFiles: outcome.manualFiles,
      autoResolvedFiles: outcome.autoResolvedFiles.length > 0 ? outcome.autoResolvedFiles : undefined,
      isRebaseConflict: plan.isRebaseConflict || undefined,
    };
  }
}

/**
 * Detect whether Already has upstream merge commit (used for first migration prompt)
 *
 * Check the last 20 merge commits to see if there is a parent reachable from upstream/main.
 * If there is → Already had regular merge before → No migration needed.
 * If not → you may always use squash merge → a migration prompt is required.
 */
export function hasUpstreamMergeHistory(): boolean {
  if (!hasUpstreamTrackingRef()) return false;
  for (const line of parseGitLines(gitSafe('log --merges --format=%P -20 HEAD'))) {
    // Skip the first parent (this branch) and check whether subsequent parents are in the upstream history
    // Note: merge-base --is-ancestor uses exit code to represent the result, and gitSafe returns null when it fails.
    for (const parent of line.split(' ').slice(1)) {
      if (gitSafe(`merge-base --is-ancestor ${parent} ${UPSTREAM_REMOTE}/${MAIN_BRANCH}`) !== null) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Install dependencies (asynchronous)
 */
export function installDeps(
  fallbackPackageManager: unknown,
  onOutput?: (data: string) => void,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    let installCommand: PackageManagerInstallCommand;
    try {
      const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { packageManager?: unknown };
      installCommand = getPackageManagerInstallCommand(packageJson.packageManager, fallbackPackageManager);
    } catch (error) {
      resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    const child = spawn(installCommand.command, installCommand.args, {
      cwd: PROJECT_ROOT,
      shell: false,
    });

    let stderr = '';

    child.stdout?.on('data', (data) => {
      onOutput?.(data.toString());
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      onOutput?.(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/** Check if tag exists locally */
export function tagExists(tag: string): boolean {
  return hasRef(`refs/tags/${normalizeTag(tag)}`);
}

/** Get recent tags list */
export function listRecentTags(limit = 5): string[] {
  return parseGitLines(gitSafe('tag --sort=-creatordate --list "v*"')).slice(0, limit);
}
