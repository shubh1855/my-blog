import path from 'node:path';
import type { Dispatch } from 'react';
import { BACKUP_DIR } from '../constants/paths';
import { UPSTREAM_URL, type UpdateAction, type UpdateState, type UpdateStatus } from '../constants/update';
import { git, resetHard } from './git-porcelain';
import { restoreBackup } from './restore-operations';
import {
  checkGitStatus,
  ensureUpstreamRemote,
  fetchUpstream,
  getUpdateInfo,
  hasUpstreamMergeHistory,
  hasUpstreamTrackingRef,
  installDeps,
  listRecentTags,
  mergeUpstream,
  readProjectPackageManager,
  tagExists,
} from './update-operations';

/** Effect function type: receives the current status and dispatch, and can return the cleanup function */

type EffectFn = (state: UpdateState, dispatch: Dispatch<UpdateAction>) => (() => void) | undefined;

/**
 * Clean mode: Restore user content from backup and amend to merge commit.
 *
 * This spans the git and backup domains, so it lives in the effect layer rather
 * than inside either operation module.
 * @param preCleanSha commit SHA before merging, roll back to this state when restore fails
 */
function cleanRestore(backupPath: string, preCleanSha?: string): string[] {
  try {
    // restoreBackup throws when content migration fails, so a returned result is always fully migrated.
    const { restoredFiles } = restoreBackup(backupPath);
    git('add -A');
    git('commit --amend --no-edit');
    return restoredFiles;
  } catch (error) {
    // Restore failed, rollback to pre-merge state to protect user data
    if (preCleanSha) resetHard(preCleanSha);
    throw error;
  }
}

/**
 * State side effect mapping table
 * Each state that needs to perform side effects corresponds to an effect function
 */
export const statusEffects: Partial<Record<UpdateStatus, EffectFn>> = {
  checking: (state, dispatch) => {
    try {
      // --clean and --rebase are mutually exclusive
      if (state.options.clean && state.options.rebase) {
        dispatch({ type: 'ERROR', error: '--clean and --rebase cannot be used together' });
        return undefined;
      }

      const gitStatus = checkGitStatus();
      const packageManager = readProjectPackageManager();
      const { checkOnly } = state.options;

      // Make sure the upstream remote exists
      const upstream = ensureUpstreamRemote({ allowAdd: !checkOnly });
      if (!upstream.success) {
        if (upstream.reason === 'mismatch') {
          const currentUrl = upstream.currentUrl ?? 'unknown';
          dispatch({
            type: 'ERROR',
            error: `upstream already exists but points to ${currentUrl}, please manually adjust to ${UPSTREAM_URL}`,
          });
          return undefined;
        }
        if (upstream.reason === 'missing' && checkOnly) {
          dispatch({
            type: 'ERROR',
            error: 'Check mode doesn't modify repository, please manually add upstream or use non --check mode',
          });
          return undefined;
        }
        dispatch({ type: 'ERROR', error: 'Cannot add upstream remote' });
        return undefined;
      }

      dispatch({ type: 'GIT_CHECKED', payload: gitStatus, packageManager });
    } catch (err) {
      dispatch({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
    return undefined;
  },

  fetching: (state, dispatch) => {
    try {
      if (state.options.checkOnly) {
        if (!hasUpstreamTrackingRef()) {
          dispatch({
            type: 'ERROR',
            error: 'Check mode doesn't run git fetch, please manually run git fetch upstream',
          });
          return undefined;
        }
      } else {
        const success = fetchUpstream();
        if (!success) {
          dispatch({ type: 'ERROR', error: 'Cannot fetch upstream updates, please check network connection' });
          return undefined;
        }
      }

      // If targetTag is specified, verify its existence
      if (state.options.targetTag && !tagExists(state.options.targetTag)) {
        const recentTags = listRecentTags(5);
        const tagsHint = recentTags.length > 0 ? `\nAvailable versions: ${recentTags.join(', ')}` : '';
        dispatch({
          type: 'ERROR',
          error: `Tag "${state.options.targetTag}" does not exist${tagsHint}`,
        });
        return undefined;
      }

      const info = getUpdateInfo(state.options.targetTag);

      // Check whether the first migration prompt is required (not required in rebase/clean mode)
      const needsMigration = !state.options.clean && !state.options.rebase && !hasUpstreamMergeHistory();

      dispatch({ type: 'FETCHED', payload: info, needsMigration });
    } catch (err) {
      dispatch({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
    return undefined;
  },

  merging: (state, dispatch) => {
    let cancelled = false;

    // Delay to microtask to let Ink render one frame of Spinner first (execSync will still block subsequent frames)
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        const result = mergeUpstream({
          targetTag: state.options.targetTag,
          isDowngrade: state.updateInfo?.isDowngrade,
          rebase: state.options.rebase,
          clean: state.options.clean,
        });
        dispatch({ type: 'MERGED', payload: result });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      cancelled = true;
    };
  },

  'clean-restoring': (state, dispatch) => {
    let cancelled = false;

    // Delay to microtask to let Ink render one frame of Spinner first (execSync will still block subsequent frames)
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        if (!state.backupFile) {
          dispatch({ type: 'ERROR', error: 'Clean mode requires a backup, but no backup found' });
          return;
        }
        // backupFile stores basename and needs to construct a full path
        const fullPath = path.join(BACKUP_DIR, state.backupFile);
        const restoredFiles = cleanRestore(fullPath, state.mergeResult?.preCleanSha);
        dispatch({ type: 'CLEAN_RESTORED', restoredFiles });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: 'ERROR', error: `Restore user content failed: ${err instanceof Error ? err.message : String(err)}` });
      });

    return () => {
      cancelled = true;
    };
  },

  installing: (state, dispatch) => {
    let cancelled = false;

    installDeps(state.packageManager)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          dispatch({ type: 'ERROR', error: `Dependency installation failed: ${result.error}` });
          return;
        }
        dispatch({ type: 'INSTALLED' });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
      });

    // Return the cleanup function to prevent the Update status after the component is uninstalled
    return () => {
      cancelled = true;
    };
  },
};
