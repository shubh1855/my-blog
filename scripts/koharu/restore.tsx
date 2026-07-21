import path from 'node:path';
import { ConfirmInput, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import { CycleSelect as Select } from './components';
import {
  AUTO_EXIT_DELAY,
  type BackupInfo,
  getBackupList,
  getRestorePreview,
  type RestorePreviewItem,
  restoreBackup,
  tarExtractManifest,
  usePressAnyKey,
  useRetimer,
  validateBackupFilePath,
} from './shared';

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
  const [error, setError] = useState<string>('');
  const [manifest, setManifest] = useState<{ type?: string; version?: string; timestamp?: string } | null>(null);

  const [backups] = useState<BackupInfo[]>(() => getBackupList());
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
      setRestoredFiles(previewFiles);
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
      const restored = restoreBackup(selectedBackup);
      setRestoredFiles(restored);
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
      runRestore();
    }
  }, [selectedBackup, status, runRestore, force]);

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

  // Listen for any key to return to main menu
  usePressAnyKey((status === 'done' || status === 'error' || status === 'cancelled') && showReturnHint, () => {
    onComplete?.();
  });

  if (backups.length === 0 && status === 'selecting') {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No backup files found</Text>
        <Text dimColor>Use 'pnpm koharu backup' to create a backup</Text>
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
                label: `${b.name}  ${b.sizeFormatted}  ${b.type === 'full' ? '[full]' : '[basic]'}`,
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
            <Text color="yellow">{dryRun ? '[Preview mode] ' : ''}Confirm restore? This will overwrite existing files</Text>
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
              {dryRun ? 'Preview mode' : 'Restore complete'}
            </Text>
          </Box>
          {restoredFiles.map((item) => {
            const isPreviewItem = typeof item !== 'string';
            const filePath = isPreviewItem ? item.path : item;
            const fileCount = isPreviewItem ? item.fileCount : 0;
            return (
              <Text key={filePath}>
                <Text color="green">{'  '}+ </Text>
                <Text>{filePath}</Text>
                {isPreviewItem && fileCount > 1 && <Text dimColor> ({fileCount} files)</Text>}
              </Text>
            );
          })}
          <Box marginTop={1}>
            <Text>
              {dryRun ? 'Will restore:' : 'Restored:'} <Text color="green">{restoredFiles.length}</Text> items
            </Text>
          </Box>
          {dryRun && (
            <Box marginTop={1}>
              <Text color="yellow">Preview mode: no files were modified</Text>
            </Box>
          )}
          {!dryRun && (
            <Box flexDirection="column" marginTop={1}>
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
