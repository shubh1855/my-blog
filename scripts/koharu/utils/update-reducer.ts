import { MAIN_BRANCH, type UpdateAction, type UpdateOptions, type UpdateState } from '../constants/update';

/**
 * Internal implementation note.
 * Internal implementation note.
 */
export function updateReducer(state: UpdateState, action: UpdateAction): UpdateState {
  const { status, options } = state;

  // Internal implementation note.
  if (action.type === 'ERROR') {
    return { ...state, status: 'error', error: action.error };
  }

  switch (status) {
    case 'checking': {
      if (action.type !== 'GIT_CHECKED') return state;
      const { payload: gitStatus } = action;

      // Internal implementation note.
      const branchWarning =
        gitStatus.currentBranch !== MAIN_BRANCH
          ? `Currently on ${gitStatus.currentBranch} branch; recommend running update on ${MAIN_BRANCH} branch`
          : '';

      // Internal implementation note.
      if (!gitStatus.isClean && !options.force) {
        return { ...state, status: 'dirty-warning', gitStatus, branchWarning };
      }

      return { ...state, status: 'fetching', gitStatus, branchWarning };
    }

    case 'fetching': {
      if (action.type !== 'FETCHED') return state;
      const { payload: updateInfo, needsMigration } = action;

      // Internal implementation note.
      const versionsMatch = updateInfo.currentVersion === updateInfo.latestVersion && updateInfo.latestVersion !== 'unknown';

      // Internal implementation note.
      // Internal implementation note.
      const hasChanges =
        !versionsMatch && (updateInfo.behindCount > 0 || (updateInfo.isDowngrade && updateInfo.aheadCount > 0));

      if (!hasChanges) {
        return { ...state, status: 'up-to-date', updateInfo };
      }

      // Internal implementation note.
      const forceBackup = options.rebase || options.clean;
      const nextStatus = forceBackup ? 'backup-confirm' : options.skipBackup || options.force ? 'preview' : 'backup-confirm';
      return { ...state, status: nextStatus, updateInfo, needsMigration: needsMigration ?? false };
    }

    case 'backup-confirm': {
      if (action.type === 'BACKUP_CONFIRM') {
        return { ...state, status: 'backing-up' };
      }
      // Internal implementation note.
      if (action.type === 'BACKUP_SKIP' && !options.rebase && !options.clean) {
        return { ...state, status: 'preview' };
      }
      return state;
    }

    case 'backing-up': {
      if (action.type === 'BACKUP_DONE') {
        return { ...state, status: 'preview', backupFile: action.backupFile };
      }
      return state;
    }

    case 'preview': {
      if (action.type === 'UPDATE_CONFIRM') {
        return { ...state, status: 'merging' };
      }
      // Internal implementation note.
      return state;
    }

    case 'merging': {
      if (action.type !== 'MERGED') return state;
      const { payload: result } = action;

      if (result.hasConflict) {
        return { ...state, status: 'conflict', mergeResult: result };
      }
      if (!result.success) {
        return { ...state, status: 'error', error: result.error || 'Merge failed' };
      }
      // Internal implementation note.
      if (options.clean) {
        return { ...state, status: 'clean-restoring', mergeResult: result };
      }
      return { ...state, status: 'installing', mergeResult: result };
    }

    case 'clean-restoring': {
      if (action.type === 'CLEAN_RESTORED') {
        return { ...state, status: 'installing', restoredFiles: action.restoredFiles };
      }
      return state;
    }

    case 'installing': {
      if (action.type === 'INSTALLED') {
        return { ...state, status: 'done' };
      }
      return state;
    }

    // Internal implementation note.
    case 'dirty-warning':
    case 'done':
    case 'conflict':
    case 'up-to-date':
    case 'error':
      return state;

    default:
      return state;
  }
}

/** Internal implementation note. */
export function createInitialState(options: UpdateOptions): UpdateState {
  return {
    status: 'checking',
    gitStatus: null,
    updateInfo: null,
    mergeResult: null,
    backupFile: '',
    error: '',
    branchWarning: '',
    options,
    needsMigration: false,
    restoredFiles: [],
  };
}
