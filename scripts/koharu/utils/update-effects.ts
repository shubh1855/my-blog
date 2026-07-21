import path from 'node:path';
import type { Dispatch } from 'react';
import { BACKUP_DIR } from '../constants/paths';
import { UPSTREAM_URL, type UpdateAction, type UpdateState, type UpdateStatus } from '../constants/update';
import {
  checkGitStatus,
  cleanRestore,
  ensureUpstreamRemote,
  fetchUpstream,
  getUpdateInfo,
  hasUpstreamMergeHistory,
  hasUpstreamTrackingRef,
  installDeps,
  listRecentTags,
  mergeUpstream,
  tagExists,
} from './update-operations';

/** Internal implementation note. */
type EffectFn = (state: UpdateState, dispatch: Dispatch<UpdateAction>) => (() => void) | undefined;

/**
 * Internal implementation note.
 * Internal implementation note.
 */
export const statusEffects: Partial<Record<UpdateStatus, EffectFn>> = {
  checking: (state, dispatch) => {
    try {
      // Internal implementation note.
      if (state.options.clean && state.options.rebase) {
        dispatch({ type: 'ERROR', error: '--clean and --rebase cannot be used together' });
        return undefined;
      }

      const gitStatus = checkGitStatus();
      const { checkOnly } = state.options;

      // Internal implementation note.
      const upstream = ensureUpstreamRemote({ allowAdd: !checkOnly });
      if (!upstream.success) {
        if (upstream.reason === 'mismatch') {
          const currentUrl = upstream.currentUrl ?? 'unknown';
          dispatch({
            type: 'ERROR',
            error: `upstream already exists but points to ${currentUrl}; please manually change it to  ${UPSTREAM_URL}`,
          });
          return undefined;
        }
        if (upstream.reason === 'missing' && checkOnly) {
          dispatch({
            type: 'ERROR',
            error: 'Check mode does not modify the repository; add upstream manually or use non---check mode',
          });
          return undefined;
        }
        dispatch({ type: 'ERROR', error: 'Unable to add upstream remote' });
        return undefined;
      }

      dispatch({ type: 'GIT_CHECKED', payload: gitStatus });
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
            error: 'Check mode does not run git fetch; run git fetch upstream manually',
          });
          return undefined;
        }
      } else {
        const success = fetchUpstream();
        if (!success) {
          dispatch({ type: 'ERROR', error: 'Unable to fetch upstream updates; check network connection' });
          return undefined;
        }
      }

      // Internal implementation note.
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

      // Internal implementation note.
      const needsMigration = !state.options.clean && !state.options.rebase && !hasUpstreamMergeHistory();

      dispatch({ type: 'FETCHED', payload: info, needsMigration });
    } catch (err) {
      dispatch({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
    return undefined;
  },

  merging: (state, dispatch) => {
    let cancelled = false;

    // Internal implementation note.
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

    // Internal implementation note.
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        if (!state.backupFile) {
          dispatch({ type: 'ERROR', error: 'Clean mode needs a backup file, but no backup was found' });
          return;
        }
        // Internal implementation note.
        const fullPath = path.join(BACKUP_DIR, state.backupFile);
        const restoredFiles = cleanRestore(fullPath, state.mergeResult?.preCleanSha);
        dispatch({ type: 'CLEAN_RESTORED', restoredFiles });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({
          type: 'ERROR',
          error: `Failed to restore user content: ${err instanceof Error ? err.message : String(err)}`,
        });
      });

    return () => {
      cancelled = true;
    };
  },

  installing: (_state, dispatch) => {
    let cancelled = false;

    installDeps()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          dispatch({ type: 'ERROR', error: `Dependency install failed: ${result.error}` });
          return;
        }
        dispatch({ type: 'INSTALLED' });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
      });

    // Internal implementation note.
    return () => {
      cancelled = true;
    };
  },
};
