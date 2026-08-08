import path from 'node:path';
import { ConfirmInput, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { CycleSelect as Select } from './components';
import { AUTO_EXIT_DELAY } from './constants';
import type { ReleaseInfo, UpdateOptions } from './constants/update';
import { usePressAnyKey, useRetimer } from './hooks';
import {
  abortMerge,
  abortRebase,
  buildReleaseUrl,
  createInitialState,
  extractReleaseSummary,
  fetchReleaseInfo,
  runBackup,
  selectUpdatePresentation,
  statusEffects,
  updateReducer,
} from './utils';

interface UpdateAppProps {
  checkOnly?: boolean;
  skipBackup?: boolean;
  force?: boolean;
  targetTag?: string;
  rebase?: boolean;
  dryRun?: boolean;
  clean?: boolean;
  showReturnHint?: boolean;
  onComplete?: () => void;
}

export function UpdateApp({
  checkOnly = false,
  skipBackup = false,
  force = false,
  targetTag,
  rebase = false,
  dryRun = false,
  clean = false,
  showReturnHint = false,
  onComplete,
}: UpdateAppProps) {
  const options: UpdateOptions = { checkOnly, skipBackup, force, targetTag, rebase, dryRun, clean };
  const [state, dispatch] = useReducer(updateReducer, options, createInitialState);

  // Load release info asynchronously
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);

  const {
    status,
    gitStatus,
    updateInfo,
    mergeResult,
    backupFile,
    error,
    branchWarning,
    restoredFiles,
    options: stateOptions,
  } = state;
  const presentation = selectUpdatePresentation(state);
  const retimer = useRetimer();

  // Unified completion handler
  const handleComplete = useCallback(() => {
    if (!showReturnHint) {
      retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
    }
  }, [showReturnHint, onComplete, retimer]);

  // Auto complete on final state
  useEffect(() => {
    if (status === 'up-to-date' || status === 'done' || status === 'error') {
      handleComplete();
    }
  }, [status, handleComplete]);

  // checkOnly or dryRun mode completes in preview state
  useEffect(() => {
    if (status === 'preview' && (stateOptions.checkOnly || stateOptions.dryRun)) {
      handleComplete();
    }
  }, [status, stateOptions.checkOnly, stateOptions.dryRun, handleComplete]);

  // Load release info asynchronously in preview state
  useEffect(() => {
    if (status === 'preview' && updateInfo?.latestVersion && updateInfo.latestVersion !== 'unknown') {
      setReleaseLoading(true);
      fetchReleaseInfo(updateInfo.latestVersion)
        .then((info) => {
          setReleaseInfo(info);
        })
        .catch(() => {
          // Fail silently
        })
        .finally(() => {
          setReleaseLoading(false);
        });
    }
  }, [status, updateInfo?.latestVersion]);

  // Core: handle all side effects in single effect
  useEffect(() => {
    const effect = statusEffects[status];
    if (!effect) return;
    return effect(state, dispatch);
  }, [status, state]);

  // Force mode auto confirm (except checkOnly and dryRun mode)
  useEffect(() => {
    if (status === 'preview' && stateOptions.force && !stateOptions.checkOnly && !stateOptions.dryRun) {
      dispatch({ type: 'UPDATE_CONFIRM' });
    }
  }, [status, stateOptions.force, stateOptions.checkOnly, stateOptions.dryRun]);

  // Interactive handler
  const handleBackupConfirm = useCallback(() => {
    dispatch({ type: 'BACKUP_CONFIRM' });
    try {
      const result = runBackup(true);
      dispatch({ type: 'BACKUP_DONE', backupFile: path.basename(result.backupFile) });
    } catch (err) {
      dispatch({ type: 'ERROR', error: `Backup failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, []);

  const handleBackupSkip = useCallback(() => dispatch({ type: 'BACKUP_SKIP' }), []);
  const handleUpdateConfirm = useCallback(() => dispatch({ type: 'UPDATE_CONFIRM' }), []);
  const handleUpdateCancel = useCallback(() => onComplete?.(), [onComplete]);
  const handleBackupSelect = useCallback(
    (value: string) => {
      if (value === 'backup') handleBackupConfirm();
      else if (value === 'skip') handleBackupSkip();
      else handleUpdateCancel();
    },
    [handleBackupConfirm, handleBackupSkip, handleUpdateCancel],
  );

  const handleAbortMerge = useCallback(() => {
    const success = abortMerge();
    if (success) {
      onComplete?.();
    } else {
      dispatch({ type: 'ERROR', error: 'Failed to abort merge, please manually run git merge --abort' });
    }
  }, [onComplete]);

  const handleAbortRebase = useCallback(() => {
    const success = abortRebase();
    if (success) {
      onComplete?.();
    } else {
      dispatch({ type: 'ERROR', error: 'Failed to abort rebase, please manually run git rebase --abort' });
    }
  }, [onComplete]);

  // Press any key to return to menu
  usePressAnyKey(
    (status === 'done' ||
      status === 'error' ||
      status === 'up-to-date' ||
      status === 'dirty-warning' ||
      (status === 'preview' && (stateOptions.checkOnly || stateOptions.dryRun))) &&
      showReturnHint,
    () => {
      onComplete?.();
    },
  );

  return (
    <Box flexDirection="column">
      {/* Checking status */}
      {status === 'checking' && (
        <Box>
          <Spinner label="Checking Git status..." />
        </Box>
      )}

      {/* Dirty warning */}
      {status === 'dirty-warning' && gitStatus && (
        <Box flexDirection="column">
          <Text color="yellow" bold>
            Working tree has uncommitted changes
          </Text>
          <Box marginTop={1} flexDirection="column">
            {gitStatus.uncommittedFiles.slice(0, 5).map((file) => (
              <Text key={file} dimColor>
                {'  '}- {file}
              </Text>
            ))}
            {gitStatus.uncommittedFiles.length > 5 && (
              <Text dimColor>
                {'  '}... plus {gitStatus.uncommittedFiles.length - 5} files
              </Text>
            )}
          </Box>
          <Box marginTop={1}>
            <Text>Please commit or stash your changes first:</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>{'  '}git add . && git commit -m "save changes"</Text>
            <Text dimColor>{'  '}# Or</Text>
            <Text dimColor>{'  '}git stash</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Tip: use --force to skip this check (not recommended)</Text>
          </Box>
          {showReturnHint && (
            <Box marginTop={1}>
              <Text dimColor>Press any key to return to main menu...</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Backup confirmation */}
      {status === 'backup-confirm' && (
        <Box flexDirection="column">
          {presentation.forceBackup ? (
            // Rebase/Clean mode: forced backup, can only confirm or cancel entire flow
            <>
              <Box marginBottom={1} flexDirection="column">
                <Text color="yellow" bold>
                  ⚠ {presentation.forcedBackupModeLabel} mode requires backup
                </Text>
                {stateOptions.skipBackup && (
                  <Text color="yellow" dimColor>
                    {'  '}（--skip-backup was ignored）
                  </Text>
                )}
              </Box>
              <Text>Confirm execute backup?</Text>
              <Box marginTop={1}>
                <ConfirmInput onConfirm={handleBackupConfirm} onCancel={handleUpdateCancel} />
              </Box>
            </>
          ) : (
            // Normal mode: three options - Backup/Skip/Cancel
            <>
              <Text>Backup current content before updating?</Text>
              <Text dimColor>Backup will save blog posts, configs, etc. to allow recovery on failure</Text>
              <Box marginTop={1}>
                <Select
                  options={[
                    { label: 'Yes - Backup then update', value: 'backup' },
                    { label: 'No - Skip backup and update directly', value: 'skip' },
                    { label: 'Cancel - Exit update process', value: 'cancel' },
                  ]}
                  onChange={handleBackupSelect}
                />
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Tip: use --skip-backup to skip this prompt</Text>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* Backing up */}
      {status === 'backing-up' && (
        <Box>
          <Spinner label="Backing up..." />
        </Box>
      )}

      {/* Fetching */}
      {status === 'fetching' && (
        <Box>
          <Spinner label="Fetching updates..." />
        </Box>
      )}

      {/* Preview */}
      {status === 'preview' && updateInfo && (
        <Box flexDirection="column">
          {/* Rebase mode warning */}
          {presentation.showRebaseWarning && (
            <Box marginBottom={1}>
              <Text color="red" bold>
                ⚠ REBASE MODE - history will be rewritten!
              </Text>
            </Box>
          )}

          {backupFile && (
            <Box marginBottom={1}>
              <Text color="green">
                {'  '}+ Backup complete: {backupFile}
              </Text>
            </Box>
          )}

          {/* Downgrade warning */}
          {presentation.showDowngradeWarning && (
            <Box marginBottom={1} flexDirection="column">
              <Text color="yellow" bold>
                ⚠ This is a downgrade operation, will roll back to an older version
              </Text>
              <Text color="yellow">{'  '}Downgrading will overwrite all theme files, ensure you have backed up custom content</Text>
              {!backupFile && <Text color="red">{'  '}⚠ You haven't performed a backup! Strongly recommend cancelling and backing up first</Text>}
            </Box>
          )}

          {/* Branch warning */}
          {branchWarning && (
            <Box marginBottom={1}>
              <Text color="yellow">⚠ {branchWarning}</Text>
            </Box>
          )}

          {/* Version information */}
          <Box marginBottom={1}>
            <Text bold>
              {updateInfo.isDowngrade ? (
                <>
                  Downgrade to version: <Text color="cyan">v{updateInfo.currentVersion}</Text> →{' '}
                  <Text color="yellow">v{updateInfo.latestVersion}</Text>
                </>
              ) : stateOptions.targetTag ? (
                <>
                  Update to specified version: <Text color="cyan">v{updateInfo.currentVersion}</Text> →{' '}
                  <Text color="green">v{updateInfo.latestVersion}</Text>
                </>
              ) : (
                <>
                  New version found: <Text color="cyan">v{updateInfo.currentVersion}</Text> →{' '}
                  <Text color="green">v{updateInfo.latestVersion}</Text>
                </>
              )}
            </Text>
          </Box>

          {/* Release information (upgrade only) */}
          {!updateInfo.isDowngrade && (
            <Box marginBottom={1} flexDirection="column">
              {releaseLoading ? (
                <Text dimColor>Fetching update notes...</Text>
              ) : releaseInfo?.body ? (
                <>
                  <Text bold color="magenta">
                    Changes:
                  </Text>
                  {extractReleaseSummary(releaseInfo.body).map((line, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Release summary lines are static and may repeat
                    <Text key={index} dimColor>
                      {'  '}
                      {line}
                    </Text>
                  ))}
                </>
              ) : (
                <Text dimColor>(Cannot get detailed update notes)</Text>
              )}
              {updateInfo.latestVersion !== 'unknown' && (
                <Box marginTop={1}>
                  <Text>
                    View full notes:{' '}
                    <Text color="blue" underline>
                      {buildReleaseUrl(updateInfo.latestVersion)}
                    </Text>
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* Commit list */}
          <Text bold>
            {updateInfo.isDowngrade ? `Will remove ${updateInfo.aheadCount} commits:` : `Found ${updateInfo.behindCount} new commits:`}
          </Text>
          <Box marginTop={1} flexDirection="column">
            {updateInfo.commits.slice(0, 10).map((commit) => (
              <Text key={commit.hash}>
                <Text color={updateInfo.isDowngrade ? 'red' : 'yellow'}>
                  {'  '}
                  {updateInfo.isDowngrade ? '-' : '+'} {commit.hash}
                </Text>
                <Text> {commit.message}</Text>
                <Text dimColor> ({commit.date})</Text>
              </Text>
            ))}
            {updateInfo.commits.length > 10 && (
              <Text dimColor>
                {'  '}... plus {updateInfo.commits.length - 10} commits
              </Text>
            )}
          </Box>

          {/* Display local-ahead hint only on upgrade */}
          {!updateInfo.isDowngrade && updateInfo.aheadCount > 0 && (
            <Box marginTop={1}>
              <Text color="yellow">Tip: local has {updateInfo.aheadCount} commits ahead of upstream template</Text>
            </Box>
          )}

          {/* First migration hint */}
          {presentation.showMigrationHint && (
            <Box marginTop={1}>
              <Text color="yellow">⚠ Detected first-time migration from squash merge, --clean mode is recommended for zero conflicts</Text>
            </Box>
          )}

          {stateOptions.checkOnly || stateOptions.dryRun ? (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                {stateOptions.dryRun
                  ? 'This is dry-run mode, no actual operation executed'
                  : `This is check mode, no ${updateInfo.isDowngrade ? 'downgrade' : 'update'} executed`}
              </Text>
              {stateOptions.dryRun && stateOptions.rebase && (
                <Box marginTop={1} flexDirection="column">
                  <Text>If executing rebase, will:</Text>
                  <Text dimColor>{'  '}• Replay local commits on top of target reference</Text>
                  <Text dimColor>{'  '}• Rewrite commit history (commit hash will change)</Text>
                  <Text dimColor>{'  '}• Requires backup first</Text>
                  {updateInfo.localCommits.length > 0 && (
                    <Box marginTop={1} flexDirection="column">
                      <Text bold>Local commits to be replayed ({updateInfo.localCommits.length}):</Text>
                      {updateInfo.localCommits.slice(0, 10).map((commit) => (
                        <Text key={commit.hash}>
                          <Text color="cyan">
                            {'  '}
                            {commit.hash}
                          </Text>
                          <Text> {commit.message}</Text>
                          <Text dimColor> ({commit.date})</Text>
                        </Text>
                      ))}
                      {updateInfo.localCommits.length > 10 && (
                        <Text dimColor>
                          {'  '}... plus {updateInfo.localCommits.length - 10} commits
                        </Text>
                      )}
                    </Box>
                  )}
                </Box>
              )}
              {stateOptions.dryRun && stateOptions.clean && (
                <Box marginTop={1} flexDirection="column">
                  <Text>If executing clean mode, will:</Text>
                  <Text dimColor>{'  '}• Replace all theme files with latest upstream version</Text>
                  <Text dimColor>{'  '}• Restore user content from backup (blog posts, configs, etc.)</Text>
                  <Text dimColor>{'  '}• Zero conflicts, suitable for first-time migration</Text>
                </Box>
              )}
              {updateInfo.isDowngrade && !stateOptions.dryRun && (
                <Box marginTop={1}>
                  <Text color="yellow">Tip: ensure your blog content is backed up before downgrading</Text>
                  <Text dimColor>{'  '}pnpm koharu backup # perform backup</Text>
                </Box>
              )}
              {showReturnHint && (
                <Box marginTop={1}>
                  <Text dimColor>Press any key to return to main menu...</Text>
                </Box>
              )}
            </Box>
          ) : (
            !stateOptions.force && (
              <Box marginTop={1} flexDirection="column">
                {presentation.showUnbackedDowngradeWarning && (
                  <Box marginBottom={1}>
                    <Text color="red" bold>
                      ⚠ Warning: no backup! After downgrading you must manually restore your blog content
                    </Text>
                  </Box>
                )}
                <Box flexDirection="column">
                  <Text>{presentation.confirmMessage}</Text>
                  {presentation.strategyNote && (
                    <Text dimColor>
                      {'  '}
                      {presentation.strategyNote}
                    </Text>
                  )}
                </Box>
                <ConfirmInput onConfirm={handleUpdateConfirm} onCancel={handleUpdateCancel} />
              </Box>
            )
          )}
        </Box>
      )}

      {/* Merging */}
      {status === 'merging' && (
        <Box>
          <Spinner label={`Executing ${presentation.modeLabel}...`} />
        </Box>
      )}

      {/* Clean restoring */}
      {status === 'clean-restoring' && (
        <Box>
          <Spinner label="Restoring user content..." />
        </Box>
      )}

      {/* Installing */}
      {status === 'installing' && (
        <Box>
          <Spinner label="Installing dependencies..." />
        </Box>
      )}

      {/* Done */}
      {status === 'done' && (
        <Box flexDirection="column">
          <Text bold color="green">
            {presentation.modeLabel} complete
          </Text>
          {updateInfo?.isDowngrade && !stateOptions.rebase && (
            <Text>
              AlreadyDowngrade to version: <Text color="cyan">v{updateInfo.latestVersion}</Text>
            </Text>
          )}
          {stateOptions.clean && (
            <Box flexDirection="column">
              <Text dimColor>Replaced all theme files and restored user content</Text>
              {restoredFiles.length > 0 && (
                <Box marginTop={1} flexDirection="column">
                  <Text color="cyan">Restored user content:</Text>
                  {restoredFiles.map((file) => (
                    <Text key={file} dimColor>
                      {'  '}- {file}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {/* Auto-resolved conflict file info */}
          {mergeResult?.autoResolvedFiles && mergeResult.autoResolvedFiles.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text color="cyan">The following user content files' conflicts were auto-resolved keeping local versions:</Text>
              {mergeResult.autoResolvedFiles.map((file) => (
                <Text key={file} dimColor>
                  {'  '}- {file}
                </Text>
              ))}
            </Box>
          )}
          {backupFile && (
            <Text>
              Backup file: <Text color="cyan">{backupFile}</Text>
            </Text>
          )}
{/* Warning after Rebase is completed */}
          {stateOptions.rebase && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow" bold>
⚠ Your Commit history has been synchronized with upstream
              </Text>
              <Text color="yellow">{'  '}To restore, please execute:</Text>
              <Text color="cyan">{'  '}pnpm koharu restore --latest</Text>
            </Box>
          )}
{/* Display Release link when upgrading */}
          {!updateInfo?.isDowngrade &&
            !stateOptions.rebase &&
            updateInfo?.latestVersion &&
            updateInfo.latestVersion !== 'unknown' && (
              <Box marginTop={1}>
                <Text>
View Changes:{' '}
                  <Text color="blue" underline>
                    {buildReleaseUrl(updateInfo.latestVersion)}
                  </Text>
                </Text>
              </Box>
            )}
{/* Recovery tips after downgrading */}
          {updateInfo?.isDowngrade && !stateOptions.rebase && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow" bold>
                ⚠ Important: restore your blog content now！
              </Text>
              {backupFile ? (
                <>
                  <Text>{'  '}Execute the following command to restore backup:</Text>
                  <Text color="cyan">{'  '}pnpm koharu restore --latest</Text>
                </>
              ) : (
                <Text color="red">{'  '}You didn't perform a backup, please manually restore src/content/blog and config/site.yaml</Text>
              )}
            </Box>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Next steps:</Text>
            {(updateInfo?.isDowngrade || stateOptions.rebase) && backupFile && (
              <Text dimColor>{'  '}pnpm koharu restore --latest # restore backup</Text>
            )}
            <Text dimColor>{'  '}pnpm dev # start dev server to test</Text>
          </Box>
          {showReturnHint && (
            <Box marginTop={1}>
              <Text dimColor>Press any key to return to main menu...</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Up to date */}
      {status === 'up-to-date' && (
        <Box flexDirection="column">
          <Text bold color="green">
            {stateOptions.targetTag ? 'Already this version' : 'Already latest version'}
          </Text>
          <Text>
Current version: <Text color="cyan">v{updateInfo?.currentVersion}</Text>
          </Text>
          {showReturnHint && (
            <Box marginTop={1}>
              <Text dimColor>Press any key to return to main menu...</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Conflict */}
      {status === 'conflict' && mergeResult && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            {mergeResult.isRebaseConflict ? 'Found Rebase conflicts' : 'Found merge conflicts'}
          </Text>
          {mergeResult.autoResolvedFiles && mergeResult.autoResolvedFiles.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text color="cyan">Automatically kept following user content files (local version):</Text>
              {mergeResult.autoResolvedFiles.map((file) => (
                <Text key={file} dimColor>
                  {'  '}- {file}
                </Text>
              ))}
            </Box>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text>Files with conflicts requiring manual resolution:</Text>
            {mergeResult.conflictFiles.map((file) => (
              <Text key={file} color="red">
                {'  '}- {file}
              </Text>
            ))}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text>You can:</Text>
            {mergeResult.isRebaseConflict ? (
              <>
                <Text dimColor>{'  '}1. Resolve conflicts manually then run: git add . && git rebase --continue</Text>
                <Text dimColor>{'  '}2. Abort rebase to restore pre-update state</Text>
              </>
            ) : (
              <>
                <Text dimColor>{'  '}1. Resolve conflicts manually then run: git add . && git commit</Text>
                <Text dimColor>{'  '}2. Abort merge to restore pre-update state</Text>
              </>
            )}
          </Box>
          {backupFile && (
            <Box marginTop={1}>
              <Text>
                Backup file: <Text color="cyan">{backupFile}</Text>
              </Text>
            </Box>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text>{mergeResult.isRebaseConflict ? 'Abort rebase?' : 'Abort merge?'}</Text>
            <ConfirmInput
              onConfirm={mergeResult.isRebaseConflict ? handleAbortRebase : handleAbortMerge}
              onCancel={() => onComplete?.()}
            />
          </Box>
        </Box>
      )}

      {/* Error */}
      {status === 'error' && (
        <Box flexDirection="column">
          <Text bold color="red">
Update failed
          </Text>
          <Text color="red">{error}</Text>
          {showReturnHint && (
            <Box marginTop={1}>
              <Text dimColor>Press any key to return to main menu...</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
