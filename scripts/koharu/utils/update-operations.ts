import { execSync, spawn } from 'node:child_process';
import { BACKUP_ITEMS } from '../constants/backup';
import { PROJECT_ROOT } from '../constants/paths';
import {
  type CommitInfo,
  GITHUB_REPO,
  type GitStatusInfo,
  MAIN_BRANCH,
  type MergeResult,
  type ReleaseInfo,
  UPSTREAM_REMOTE,
  UPSTREAM_URL,
  type UpdateInfo,
} from '../constants/update';
import { restoreBackup } from './restore-operations';
import { getVersion } from './version';

/**
 * Internal implementation note.
 */
function git(args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error((error as { stderr: string }).stderr || error.message);
    }
    throw error;
  }
}

/**
 * Internal implementation note.
 */
function gitSafe(args: string): string | null {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function normalizeRemoteUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('ssh://')) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.hostname}${parsed.pathname.replace(/\.git$/, '')}`;
    } catch {
      return trimmed.replace(/\.git$/, '');
    }
  }
  const scpMatch = trimmed.match(/^[^@]+@([^:]+):(.+)$/);
  if (scpMatch) {
    return `${scpMatch[1]}${scpMatch[2].replace(/\.git$/, '')}`;
  }
  return trimmed.replace(/\.git$/, '');
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
 * Internal implementation note.
 */
export function checkGitStatus(): GitStatusInfo {
  const currentBranch = git('rev-parse --abbrev-ref HEAD');
  const statusOutput = gitSafe('status --porcelain') || '';
  const uncommittedFiles = statusOutput.split('\n').filter((line) => line.trim().length > 0);

  return {
    currentBranch,
    isClean: uncommittedFiles.length === 0,
    uncommittedCount: uncommittedFiles.length,
    uncommittedFiles: uncommittedFiles.map((line) => line.slice(3)), // Remove status prefix
  };
}

/**
 * Internal implementation note.
 */
export function hasUpstreamRemote(): boolean {
  return Boolean(gitSafe(`remote get-url ${UPSTREAM_REMOTE}`));
}

export function hasUpstreamTrackingRef(): boolean {
  return Boolean(gitSafe(`show-ref --verify refs/remotes/${UPSTREAM_REMOTE}/${MAIN_BRANCH}`));
}

export function getUpstreamRemoteUrl(): string | null {
  return gitSafe(`remote get-url ${UPSTREAM_REMOTE}`);
}

/**
 * Internal implementation note.
 */
export function addUpstreamRemote(): boolean {
  try {
    git(`remote add ${UPSTREAM_REMOTE} ${UPSTREAM_URL}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Internal implementation note.
 */
export function ensureUpstreamRemote(options: EnsureUpstreamOptions = {}): EnsureUpstreamResult {
  const allowAdd = options.allowAdd ?? true;
  const currentUrl = getUpstreamRemoteUrl();
  if (currentUrl) {
    const expected = normalizeRemoteUrl(UPSTREAM_URL);
    const actual = normalizeRemoteUrl(currentUrl);
    if (expected !== actual) {
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

/**
 * Internal implementation note.
 */
export function fetchUpstream(): boolean {
  try {
    git(`fetch ${UPSTREAM_REMOTE}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Internal implementation note.
 */
function parseCommits(output: string): CommitInfo[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      // Format: hash|message|date|author
      const [hash, message, date, author] = line.split('|');
      return { hash, message, date, author };
    });
}

/**
 * Internal implementation note.
 */
function normalizeTag(tag: string): string {
  return tag.startsWith('v') ? tag : `v${tag}`;
}

/**
 * Internal implementation note.
 * Internal implementation note.
 */
export function getUpdateInfo(targetTag?: string): UpdateInfo {
  const hasUpstream = hasUpstreamRemote();

  if (!hasUpstream) {
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

  // Internal implementation note.
  const normalizedTag = targetTag ? normalizeTag(targetTag) : null;
  const targetRef = normalizedTag || `${UPSTREAM_REMOTE}/${MAIN_BRANCH}`;

  // Get ahead/behind counts
  const revList = gitSafe(`rev-list --left-right --count HEAD...${targetRef}`) || '0\t0';
  const [aheadStr, behindStr] = revList.split('\t');
  const aheadCount = Number.parseInt(aheadStr, 10) || 0;
  const behindCount = Number.parseInt(behindStr, 10) || 0;

  // Internal implementation note.
  const isDowngrade = Boolean(normalizedTag && aheadCount > 0 && behindCount === 0);

  // Get commits
  const commitFormat = '%h|%s|%ar|%an';
  let commits: CommitInfo[];

  if (isDowngrade) {
    // Internal implementation note.
    const commitsOutput = gitSafe(`log ${targetRef}..HEAD --pretty=format:"${commitFormat}" --no-merges`) || '';
    commits = parseCommits(commitsOutput);
  } else {
    // Internal implementation note.
    const commitsOutput = gitSafe(`log HEAD..${targetRef} --pretty=format:"${commitFormat}" --no-merges`) || '';
    commits = parseCommits(commitsOutput);
  }

  // Internal implementation note.
  const localCommitsOutput = gitSafe(`log ${targetRef}..HEAD --pretty=format:"${commitFormat}" --no-merges`) || '';
  const localCommits = parseCommits(localCommitsOutput);

  // Internal implementation note.
  let parsedVersion = 'unknown';
  if (normalizedTag) {
    // Internal implementation note.
    parsedVersion = normalizedTag.replace(/^v/, '');
  } else {
    // Try to get latest version from upstream package.json
    const packageJsonContent = gitSafe(`show ${UPSTREAM_REMOTE}/${MAIN_BRANCH}:package.json`);
    if (packageJsonContent) {
      try {
        const packageJson = JSON.parse(packageJsonContent);
        if (packageJson.version) {
          parsedVersion = packageJson.version;
        }
      } catch {
        // JSON parse failed, keep 'unknown'
      }
    }
  }

  return {
    hasUpstream: true,
    behindCount,
    aheadCount,
    commits,
    localCommits,
    currentVersion: getVersion(),
    latestVersion: parsedVersion,
    isDowngrade,
  };
}

/** Internal implementation note. */
export interface MergeOptions {
  /** Internal implementation note. */
  targetTag?: string;
  /** Internal implementation note. */
  isDowngrade?: boolean;
  /** Internal implementation note. */
  rebase?: boolean;
  /** Internal implementation note. */
  clean?: boolean;
}

/**
 * Internal implementation note.
 */
function getVersionInfo(targetRef: string, normalizedTag: string | null): string {
  if (normalizedTag) return normalizedTag;
  const packageJsonContent = gitSafe(`show ${targetRef}:package.json`);
  if (packageJsonContent) {
    try {
      const packageJson = JSON.parse(packageJsonContent);
      if (packageJson.version) return `v${packageJson.version}`;
    } catch {
      // JSON parse failed
    }
  }
  return 'latest';
}

/**
 * Internal implementation note.
 */
const USER_CONTENT_PREFIXES = BACKUP_ITEMS.filter((item) => item.required).map((item) => item.src);

/**
 * Internal implementation note.
 */
function isUserContent(filePath: string): boolean {
  return USER_CONTENT_PREFIXES.some((prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`));
}

/**
 * Internal implementation note.
 */
function classifyConflicts(files: string[]): { userFiles: string[]; themeFiles: string[] } {
  const userFiles: string[] = [];
  const themeFiles: string[] = [];
  for (const file of files) {
    if (isUserContent(file)) {
      userFiles.push(file);
    } else {
      themeFiles.push(file);
    }
  }
  return { userFiles, themeFiles };
}

/**
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
function autoResolveUserContent(files: string[]): string[] {
  const failed: string[] = [];
  for (const file of files) {
    const checkoutOk = gitSafe(`checkout --ours -- "${file}"`) !== null;
    const addOk = checkoutOk && gitSafe(`add -- "${file}"`) !== null;
    if (!addOk) {
      // Internal implementation note.
      if (checkoutOk) {
        gitSafe(`checkout -m -- "${file}"`);
      }
      failed.push(file);
    }
  }
  return failed;
}

/**
 * Internal implementation note.
 */
function removeDeletedUpstreamFiles(targetRef: string): void {
  const localFiles = gitSafe('ls-files') || '';
  const upstreamFiles = gitSafe(`ls-tree -r --name-only ${targetRef}`) || '';

  const localSet = new Set(
    localFiles
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean),
  );
  const upstreamSet = new Set(
    upstreamFiles
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean),
  );

  const filesToRemove: string[] = [];
  for (const file of localSet) {
    if (!upstreamSet.has(file) && !isUserContent(file)) {
      filesToRemove.push(file);
    }
  }

  if (filesToRemove.length > 0) {
    // Internal implementation note.
    const BATCH_SIZE = 100;
    for (let i = 0; i < filesToRemove.length; i += BATCH_SIZE) {
      const chunk = filesToRemove.slice(i, i + BATCH_SIZE);
      const batch = chunk.map((f) => `'${f.replaceAll("'", "'\\''")}'`).join(' ');
      gitSafe(`rm --quiet -- ${batch}`);
    }
  }
}

/**
 * Internal implementation note.
 * Internal implementation note.
 */
export function cleanRestore(backupPath: string, preCleanSha?: string): string[] {
  try {
    const restored = restoreBackup(backupPath);
    git('add -A');
    git('commit --amend --no-edit');
    return restored;
  } catch (error) {
    // Internal implementation note.
    if (preCleanSha) {
      gitSafe(`reset --hard ${preCleanSha}`);
    }
    throw error;
  }
}

/**
 * Internal implementation note.
 *
 * Internal implementation note.
 * Internal implementation note.
 * Internal implementation note.
 */
export function hasUpstreamMergeHistory(): boolean {
  if (!hasUpstreamTrackingRef()) return false;
  const merges = gitSafe('log --merges --format=%P -20 HEAD');
  if (!merges) return false;
  for (const line of merges.trim().split('\n')) {
    if (!line.trim()) continue;
    const parents = line.trim().split(' ');
    // Internal implementation note.
    // Internal implementation note.
    // Internal implementation note.
    for (const parent of parents.slice(1)) {
      if (gitSafe(`merge-base --is-ancestor ${parent} ${UPSTREAM_REMOTE}/${MAIN_BRANCH}`) !== null) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Internal implementation note.
 *
 * Internal implementation note.
 * Internal implementation note.
 */
export function mergeUpstream(options: MergeOptions = {}): MergeResult {
  const { targetTag, isDowngrade, rebase, clean } = options;
  const normalizedTag = targetTag ? normalizeTag(targetTag) : null;
  const targetRef = normalizedTag || `${UPSTREAM_REMOTE}/${MAIN_BRANCH}`;

  try {
    if (rebase) {
      // Internal implementation note.
      git(`rebase ${targetRef}`);
    } else if (isDowngrade && normalizedTag) {
      // Internal implementation note.
      git(`checkout ${normalizedTag} -- .`);
      const status = gitSafe('status --porcelain') || '';
      if (status.trim().length > 0) {
        git(`commit -m "Downgrade to ${normalizedTag}"`);
      }
    } else if (clean) {
      // Internal implementation note.
      // Internal implementation note.
      const preCleanSha = git('rev-parse HEAD');
      const versionInfo = getVersionInfo(targetRef, normalizedTag);
      git(`merge -s ours --no-ff --allow-unrelated-histories ${targetRef} -m "chore: clean update to ${versionInfo}"`);
      git(`checkout ${targetRef} -- .`);
      removeDeletedUpstreamFiles(targetRef);
      // Internal implementation note.
      git('add -A');
      git('commit --amend --no-edit');
      return {
        success: true,
        hasConflict: false,
        conflictFiles: [],
        preCleanSha,
      };
    } else {
      // Internal implementation note.
      const versionInfo = getVersionInfo(targetRef, normalizedTag);
      git(`merge --no-ff --allow-unrelated-histories ${targetRef} -m "chore: merge upstream theme ${versionInfo}"`);
    }
    return {
      success: true,
      hasConflict: false,
      conflictFiles: [],
    };
  } catch (error) {
    // Internal implementation note.
    if (isDowngrade) {
      return {
        success: false,
        hasConflict: false,
        conflictFiles: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const conflictFiles = getConflictFiles();

    if (conflictFiles.length > 0) {
      // Internal implementation note.
      if (!rebase && !clean) {
        const { userFiles, themeFiles } = classifyConflicts(conflictFiles);
        if (userFiles.length > 0) {
          const failedFiles = autoResolveUserContent(userFiles);
          // Internal implementation note.
          if (failedFiles.length > 0) {
            themeFiles.push(...failedFiles);
          }
        }
        const resolvedFiles = userFiles.filter((f) => !themeFiles.includes(f));
        // Internal implementation note.
        if (themeFiles.length === 0) {
          try {
            git('commit --no-edit');
            return {
              success: true,
              hasConflict: false,
              conflictFiles: [],
              autoResolvedFiles: resolvedFiles,
            };
          } catch {
            // Internal implementation note.
          }
        }
        // Internal implementation note.
        return {
          success: false,
          hasConflict: true,
          conflictFiles: themeFiles,
          autoResolvedFiles: resolvedFiles.length > 0 ? resolvedFiles : undefined,
        };
      }

      return {
        success: false,
        hasConflict: true,
        conflictFiles,
        isRebaseConflict: rebase,
      };
    }

    return {
      success: false,
      hasConflict: false,
      conflictFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getConflictFiles(): string[] {
  const diffOutput = gitSafe('diff --name-only --diff-filter=U') || '';
  const diffFiles = diffOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (diffFiles.length > 0) {
    return Array.from(new Set(diffFiles));
  }

  const statusOutput = gitSafe('status --porcelain') || '';
  const statusFiles = statusOutput
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      const status = line.slice(0, 2);
      return status.includes('U') || status === 'AA' || status === 'DD';
    })
    .map((line) => line.slice(3));

  return Array.from(new Set(statusFiles));
}

/**
 * Internal implementation note.
 */
export function abortMerge(): boolean {
  try {
    git('merge --abort');
    return true;
  } catch {
    return false;
  }
}

/**
 * Internal implementation note.
 */
export function abortRebase(): boolean {
  try {
    git('rebase --abort');
    return true;
  } catch {
    return false;
  }
}

/**
 * Internal implementation note.
 */
export function installDeps(onOutput?: (data: string) => void): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['install'], {
      cwd: PROJECT_ROOT,
      shell: true,
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

/**
 * Internal implementation note.
 */
export function tagExists(tag: string): boolean {
  const normalizedTag = normalizeTag(tag);
  return Boolean(gitSafe(`show-ref --verify refs/tags/${normalizedTag}`));
}

/**
 * Internal implementation note.
 */
export function listRecentTags(limit = 5): string[] {
  const output = gitSafe('tag --sort=-creatordate --list "v*"') || '';
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, limit);
}

/**
 * Internal implementation note.
 */
export async function fetchReleaseInfo(version: string): Promise<ReleaseInfo | null> {
  const tag = normalizeTag(version);
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'astro-koharu-cli',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      tagName: data.tag_name,
      url: data.html_url,
      body: data.body || null,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Internal implementation note.
 */
export function buildReleaseUrl(version: string): string {
  const tag = normalizeTag(version);
  return `https://github.com/${GITHUB_REPO}/releases/tag/${tag}`;
}

/**
 * Internal implementation note.
 */
export function extractReleaseSummary(body: string | null, maxLines = 5, maxChars = 300): string[] {
  if (!body) return [];

  const lines = body
    .split('\n')
    .map((line) => line.trim())
    // Internal implementation note.
    .map((line) => line.replace(/^#{1,6}\s*/, ''))
    // Internal implementation note.
    .filter((line) => line.length > 0);

  const result: string[] = [];
  let totalChars = 0;

  for (const line of lines) {
    if (result.length >= maxLines || totalChars >= maxChars) break;
    result.push(line);
    totalChars += line.length;
  }

  // Internal implementation note.
  if (result.length < lines.length) {
    result.push('...');
  }

  return result;
}
