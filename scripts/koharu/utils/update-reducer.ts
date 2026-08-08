import { MAIN_BRANCH, type UpdateAction, type UpdateOptions, type UpdateState } from '../constants/update';

/** Rebase and clean mode rewrite workspace, backup cannot be skipped (ignore skipBackup and force) */
export function shouldForceBackup(options: UpdateOptions): boolean {
  return options.rebase || options.clean;
}

/**
 * Update process state machine Reducer
 * All state transition logic is centralized here, easy to understand and test
 */
export function updateReducer(state: UpdateState, action: UpdateAction): UpdateState {
  const { status, options } = state;

  // Universal error handling: any state can be transitioned to error
  if (action.type === 'ERROR') {
    return { ...state, status: 'error', error: action.error };
  }

  switch (status) {
    case 'checking': {
      if (action.type !== 'GIT_CHECKED') return state;
      const { payload: gitStatus } = action;

      // Branch checking - non-main branches only warn, do not prevent Updates
      const branchWarning =
        gitStatus.currentBranch !== MAIN_BRANCH
          ? `Currently on ${gitStatus.currentBranch} branch, recommend updating on ${MAIN_BRANCH} branch`
          : '';

      // Workspace dirty check
      if (!gitStatus.isClean && !options.force) {
        return { ...state, status: 'dirty-warning', gitStatus, branchWarning };
      }

      return { ...state, status: 'fetching', gitStatus, packageManager: action.packageManager, branchWarning };
    }

    case 'fetching': {
      if (action.type !== 'FETCHED') return state;
      const { payload: updateInfo, needsMigration } = action;

      // No update is required when the version numbers are the same
      const versionsMatch = updateInfo.currentVersion === updateInfo.latestVersion && updateInfo.latestVersion !== 'unknown';

      // Upgrade: behindCount > 0
      // Downgrade: isDowngrade && aheadCount > 0
      const hasChanges =
        !versionsMatch && (updateInfo.behindCount > 0 || (updateInfo.isDowngrade && updateInfo.aheadCount > 0));

      if (!hasChanges) {
        return { ...state, status: 'up-to-date', updateInfo };
      }

      const nextStatus = shouldForceBackup(options) || !(options.skipBackup || options.force) ? 'backup-confirm' : 'preview';
      return { ...state, status: nextStatus, updateInfo, needsMigration: needsMigration ?? false };
    }

    case 'backup-confirm': {
      if (action.type === 'BACKUP_CONFIRM') {
        return { ...state, status: 'backing-up' };
      }
      // Backup skipping is not allowed in Rebase and clean modes (defensive check)
      if (action.type === 'BACKUP_SKIP' && !shouldForceBackup(options)) {
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
      // UPDATE_CANCEL calls onComplete directly from the component without going through the reducer
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
      // Clean mode: User content needs to be restored after successful merger
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

    // Final state: no action is processed
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

/** Everything the update screen needs to render, derived once instead of in JSX conditions. */
export interface UpdatePresentation {
  /** Operation label, used for progress and completion prompt */
  modeLabel: string;
  confirmMessage: string;
  /** Backup cannot be skipped */
  forceBackup: boolean;
  /** Mode name in forced backup screen */
  forcedBackupModeLabel: string;
  /** Strategy explanation below confirmation screen */
  strategyNote: string | null;
  showRebaseWarning: boolean;
  showDowngradeWarning: boolean;
  showUnbackedDowngradeWarning: boolean;
  showMigrationHint: boolean;
}

/** Generate confirmation prompt text */
function getConfirmMessage(options: UpdateOptions, latestVersion: string, isDowngrade: boolean): string {
  const target = options.targetTag ? `Version v${latestVersion}` : 'latest version';
  if (options.rebase) return `Confirm rebase to ${options.targetTag ? target : 'upstream latest'}? (History will be rewritten)`;
  if (options.clean) return `Confirm clean mode update to ${target}?`;
  if (isDowngrade) return `Confirm downgrade to version v${latestVersion}?`;
  return `Confirm update to ${target}?`;
}

function getModeLabel(options: UpdateOptions, isDowngrade: boolean): string {
  if (options.rebase) return 'Rebase';
  if (options.clean) return 'Clean mode update';
  if (isDowngrade) return 'Downgrade version';
  return 'Update';
}

function getStrategyNote(options: UpdateOptions, isDowngrade: boolean): string | null {
  if (options.clean) return 'Will use clean mode: replace all theme files, restore user content';
  if (!options.rebase && !isDowngrade) return 'Will use merge to combine upstream updates';
  return null;
}

export function selectUpdatePresentation(state: UpdateState): UpdatePresentation {
  const { options, updateInfo, backupFile, needsMigration } = state;
  const isDowngrade = updateInfo?.isDowngrade ?? false;

  return {
    modeLabel: getModeLabel(options, isDowngrade),
    confirmMessage: getConfirmMessage(options, updateInfo?.latestVersion ?? 'unknown', isDowngrade),
    forceBackup: shouldForceBackup(options),
    forcedBackupModeLabel: options.rebase ? 'Rebase' : 'Clean',
    strategyNote: getStrategyNote(options, isDowngrade),
    showRebaseWarning: options.rebase,
    showDowngradeWarning: isDowngrade && !options.rebase,
    showUnbackedDowngradeWarning: isDowngrade && !options.rebase && !backupFile,
    showMigrationHint: needsMigration && !options.rebase && !options.clean,
  };
}

/** Create initial state */

export function createInitialState(options: UpdateOptions): UpdateState {
  return {
    status: 'checking',
    gitStatus: null,
    packageManager: '',
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
