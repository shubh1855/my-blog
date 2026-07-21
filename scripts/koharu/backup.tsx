import path from 'node:path';
import { Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import { CycleSelect as Select } from './components';
import { AUTO_EXIT_DELAY, type BackupResult, formatSize, runBackup, usePressAnyKey, useRetimer } from './shared';

type BackupStatus = 'selecting' | 'pending' | 'backing' | 'compressing' | 'done' | 'error';

interface BackupAppProps {
  initialFull?: boolean;
  showReturnHint?: boolean;
  onComplete?: () => void;
}

export function BackupApp({ initialFull = false, showReturnHint = false, onComplete }: BackupAppProps) {
  const [status, setStatus] = useState<BackupStatus>(initialFull ? 'pending' : 'selecting');
  const [isFullBackup, setIsFullBackup] = useState(initialFull);
  const [results, setResults] = useState<BackupResult[]>([]);
  const [backupFile, setBackupFile] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [error, setError] = useState<string>('');
  const retimer = useRetimer();

  const handleModeSelect = (value: string) => {
    if (value === 'cancel') {
      onComplete?.();
      return;
    }
    setIsFullBackup(value === 'full');
    setStatus('pending');
  };

  const executeBackup = useCallback(() => {
    try {
      setStatus('backing');

      const output = runBackup(isFullBackup, (progressResults) => {
        setResults(progressResults);
      });

      setStatus('compressing');
      // Note: compression is synchronous in runBackup, state update shows progress

      setFileSize(formatSize(output.fileSize));
      setBackupFile(output.backupFile);
      setResults(output.results);
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
  }, [isFullBackup, showReturnHint, onComplete, retimer]);

  useEffect(() => {
    if (status === 'pending') {
      executeBackup();
    }
  }, [status, executeBackup]);

  const successCount = results.filter((r) => r.success).length;
  const skippedCount = results.filter((r) => r.skipped).length;

  // Listen for any key to return to main menu
  usePressAnyKey((status === 'done' || status === 'error') && showReturnHint, () => {
    onComplete?.();
  });

  return (
    <Box flexDirection="column">
      {status === 'selecting' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text>Select backup mode:</Text>
          <Select
            options={[
              { label: 'Basic backup (blog, config, standalone pages, .env)', value: 'basic' },
              { label: 'Full backup (includes all images and generated assets)', value: 'full' },
              { label: 'Cancel', value: 'cancel' },
            ]}
            onChange={handleModeSelect}
          />
        </Box>
      )}

      {status !== 'selecting' && (
        <Box marginBottom={1}>
          <Text>
            Mode:{' '}
            <Text color="yellow" bold>
              {isFullBackup ? 'Full backup' : 'Basic backup'}
            </Text>
          </Text>
        </Box>
      )}

      {(status === 'backing' || status === 'compressing') && (
        <Box marginBottom={1}>
          <Spinner label={status === 'backing' ? 'Backing up files...' : 'Creating archive...'} />
        </Box>
      )}

      {results.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {results.map((result) => (
            <Box key={result.item.dest}>
              <Text>
                {result.success ? <Text color="green">{'  '}+ </Text> : <Text color="yellow">{'  '}- </Text>}
                <Text>{result.item.label}</Text>
                {result.skipped && <Text dimColor> (not found, skipped)</Text>}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {status === 'done' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="green">
              Backup complete
            </Text>
          </Box>
          <Text>
            Backup file: <Text color="cyan">{path.basename(backupFile)}</Text>
          </Text>
          <Text>
            File size: <Text color="yellow">{fileSize}</Text>
          </Text>
          <Text>
            Backup items: <Text color="green">{successCount}</Text>
          </Text>
          {skippedCount > 0 && (
            <Text>
              Skipped items: <Text color="yellow">{skippedCount}</Text>
            </Text>
          )}
          <Box marginTop={1}>
            <Text dimColor>Tip: after updating theme, use 'pnpm koharu restore' to restore backup</Text>
          </Box>
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
            Backup failed
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
