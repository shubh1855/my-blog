import path from 'node:path';
import { ConfirmInput, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import { CycleSelect as Select } from './components';
import { AUTO_EXIT_DELAY } from './constants';
import { usePressAnyKey, useRetimer } from './hooks';
import {
  type BackupInfo,
  type ContentMigrationPlan,
  getRestorableBackupList,
  getRestorePreview,
  type RestorePreviewItem,
  restoreBackup,
  tarExtractManifest,
  validateBackupFilePath,
} from './utils';

type RestoreStatus = 'selecting' | 'confirming' | 'restoring' | 'done' | 'error' | 'cancelled';

interface RestoreAppProps {
  initialBackupFile?: string;
  dryRun?: boolean;
  force?: boolean;
  showReturnHint?: boolean;
  onComplete?: () => void;
}

export function RestoreApp({
  initialBackupFile,
  dryRun = false,
  force = false,
  showReturnHint = false,
  onComplete,
}: RestoreAppProps) {
  const [status, setStatus] = useState<RestoreStatus>(initialBackupFile ? 'confirming' : 'selecting');
  const [selectedBackup, setSelectedBackup] = useState<string>(initialBackupFile || '');
  const [restoredFiles, setRestoredFiles] = useState<(RestorePreviewItem | string)[]>([]);
  const [migration, setMigration] = useState<ContentMigrationPlan | null>(null);
  const [error, setError] = useState<string>('');
  const [manifest, setManifest] = useState<{
    type?: string;
    version?: string;
    timestamp?: string;
    schemaVersion?: number;
  } | null>(null);

  const [backups] = useState<BackupInfo[]>(() => getRestorableBackupList());
  const retimer = useRetimer();

  useEffect(() => {
    if (selectedBackup && !manifest) {
      try {
        const validatedPath = validateBackupFilePath(selectedBackup);
        const data = tarExtractManifest(validatedPath);
        if (data) {
          setManifest(JSON.parse(data));
        }
      } catch {
        // ignore
      }
    }
  }, [selectedBackup, manifest]);

  const runDryRun = useCallback(() => {
    try {
      const previewFiles = getRestorePreview(selectedBackup);
      setRestoredFiles(previewFiles.items);
      setMigration(previewFiles.migration);
      setStatus('done');
      if (!showReturnHint) {
        retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      if (!showReturnHint) {
        retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
      }
    }
  }, [selectedBackup, showReturnHint, onComplete, retimer]);

  const runRestore = useCallback(() => {
    try {
      setStatus('restoring');
      const output = restoreBackup(selectedBackup);
      setRestoredFiles(output.restoredFiles);
      setMigration(output.migration);
      setStatus('done');
      if (!showReturnHint) {
        retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      if (!showReturnHint) {
        retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
      }
    }
  }, [selectedBackup, showReturnHint, onComplete, retimer]);

  useEffect(() => {
    if (force && selectedBackup && status === 'confirming') {
      if (dryRun) runDryRun();
      else runRestore();
    }
  }, [dryRun, force, runDryRun, runRestore, selectedBackup, status]);

  useEffect(() => {
    if (showReturnHint) return;
    if (status === 'error' || (status === 'done' && migration && migration.errors.length > 0)) {
      process.exitCode = 1;
    }
  }, [migration, showReturnHint, status]);

  function handleSelect(value: string) {
    if (value === 'cancel') {
      onComplete?.();
      return;
    }
    setSelectedBackup(value);
    setStatus('confirming');
  }

  function handleConfirm() {
    if (dryRun) {
      runDryRun();
    } else {
      runRestore();
    }
  }

  const handleCancel = useCallback(() => {
    setStatus('cancelled');
    if (!showReturnHint) {
      retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
    }
  }, [showReturnHint, onComplete, retimer]);

  // Listen for keypress to return to main menu
  usePressAnyKey((status === 'done' || status === 'error' || status === 'cancelled') && showReturnHint, () => {
    onComplete?.();
  });

  if (backups.length === 0 && status === 'selecting') {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No backup file found</Text>
        <Text dimColor>Use 'pnpm koharu backup' to create backup</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {status === 'selecting' && (
        <Box flexDirection="column">
          <Text>Select backup to restore:</Text>
          <Select
            options={[
              ...backups.map((b) => ({
                label: `${b.name}  ${b.sizeFormatted}  ${b.type === 'full' ? '[Full]' : '[Basic]'}`,
                value: b.path,
              })),
              { label: 'Cancel', value: 'cancel' },
            ]}
            onChange={handleSelect}
          />
        </Box>
      )}

      {status === 'confirming' && selectedBackup && (
        <Box flexDirection="column">
          <Text>
            Backup file: <Text color="cyan">{path.basename(selectedBackup)}</Text>
          </Text>
          {manifest && (
            <>
              <Text>
                Backup type: <Text color="yellow">{manifest.type}</Text>
              </Text>
              <Text>
                Theme version: <Text color="yellow">{manifest.version}</Text>
              </Text>
              <Text>
                Backup time: <Text color="yellow">{manifest.timestamp}</Text>
              </Text>
            </>
          )}
          <Box marginTop={1} marginBottom={1}>
            <Text color="yellow">{dryRun ? '[Preview Mode] ' : ''}Confirm restore? This will overwrite existing files</Text>
          </Box>
          {!force && <ConfirmInput onConfirm={handleConfirm} onCancel={handleCancel} />}
        </Box>
      )}

      {status === 'restoring' && (
        <Box>
          <Spinner label="Restoring..." />
        </Box>
      )}

      {status === 'done' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="green">
              {dryRun ? 'Preview mode' : 'Restore completed'}
            </Text>
          </Box>
          {restoredFiles.map((item) => {
            const isPreviewItem = typeof item !== 'string';
            const filePath = isPreviewItem ? item.path : item;
            const fileCount = isPreviewItem ? item.fileCount : 0;
            return (
              <Box key={filePath} flexDirection="column">
                <Text>
                  <Text color="green">{'  '}+ </Text>
                  <Text>{filePath}</Text>
                  {isPreviewItem && fileCount > 1 && <Text dimColor> ({fileCount} files)</Text>}
                </Text>
                {isPreviewItem && item.deletedFiles.length > 0 && (
                  <Box flexDirection="column">
                    <Text color="red">
                      {'  '}- Will delete {item.deletedFiles.length} existing files first
                    </Text>
                    {item.deletedFiles.slice(0, 10).map((deletedFile) => (
                      <Text key={deletedFile} color="red" dimColor>
                        {'    '}
                        {deletedFile}
                      </Text>
                    ))}
                    {item.deletedFiles.length > 10 && (
                      <Text color="red" dimColor>
                        {'    '}... plus {item.deletedFiles.length - 10} more
                      </Text>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
          <Box marginTop={1}>
            <Text>
              {dryRun ? 'Will restore' : 'Restored'}: <Text color="green">{restoredFiles.length}</Text> items
            </Text>
          </Box>
          {!dryRun && migration && migration.changes.length > 0 && migration.errors.length === 0 && (
            <Box marginTop={1}>
              <Text color="green">Automatically migrated stable links for {migration.changes.length} historical posts</Text>
            </Box>
          )}
          {!dryRun && migration && migration.errors.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="red" bold>
                {migration.errors.length} posts cannot be auto-migrated
              </Text>
              {migration.errors.slice(0, 5).map((issue) => (
                <Text key={`${issue.file}:${issue.message}`} color="red">
                  {'  '}- {issue.file}: {issue.message}
                </Text>
              ))}
              <Text color="yellow">Run after fixing: pnpm koharu migrate</Text>
            </Box>
          )}
          {dryRun && migration && migration.changes.length > 0 && migration.errors.length === 0 && (
            <Box marginTop={1}>
              <Text color="yellow">
                Will auto-migrate stable links for {migration.changes.length} historical posts after restore
              </Text>
            </Box>
          )}
          {dryRun && migration && migration.errors.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="red" bold>
                Preview found {migration.errors.length} content migration issues
              </Text>
              {migration.errors.slice(0, 5).map((issue) => (
                <Text key={`${issue.file}:${issue.message}`} color="red">
                  {'  '}- {issue.file}: {issue.message}
                </Text>
              ))}
            </Box>
          )}
          {dryRun && (
            <Box marginTop={1}>
              <Text color="yellow">This is preview mode, no files modified</Text>
            </Box>
          )}
          {!dryRun && (
            <Box flexDirection="column" marginTop={1}>
              {manifest?.type === 'basic' && (
                <Text color="yellow">
                  Basic backup excludes generated assets; please run pnpm koharu generate all when posts change
                </Text>
              )}
              <Text dimColor>Next steps:</Text>
              <Text dimColor>{'  '}1. pnpm install # install dependencies</Text>
              <Text dimColor>{'  '}2. pnpm build # build project</Text>
              <Text dimColor>{'  '}3. pnpm dev # start dev server</Text>
            </Box>
          )}
          {showReturnHint && (
            <Box marginTop={1}>
              <Text dimColor>Press any key to return to main menu...</Text>
            </Box>
          )}
        </Box>
      )}

      {status === 'cancelled' && (
        <Box flexDirection="column">
          <Text color="yellow">Cancelled</Text>
          {showReturnHint && (
            <Box marginTop={1}>
              <Text dimColor>Press any key to return to main menu...</Text>
            </Box>
          )}
        </Box>
      )}

      {status === 'error' && (
        <Box flexDirection="column">
          <Text bold color="red">
            Restore failed
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
