import { ConfirmInput, MultiSelect } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import { AUTO_EXIT_DELAY } from './constants';
import { usePressAnyKey, useRetimer } from './hooks';
import { type BackupInfo, deleteBackups, formatSize, getBackupList } from './utils';

type CleanStatus = 'selecting' | 'confirming' | 'deleting' | 'done' | 'cancelled';

interface CleanAppProps {
  keepCount?: number | null;
  showReturnHint?: boolean;
  onComplete?: () => void;
}

const AUTO_CONFIRM_DELAY = 500;

export function CleanApp({ keepCount = null, showReturnHint = false, onComplete }: CleanAppProps) {
  const [backups] = useState<BackupInfo[]>(() => getBackupList());
  const [status, setStatus] = useState<CleanStatus>(keepCount !== null ? 'confirming' : 'selecting');
  const [selectedPaths, setSelectedPaths] = useState<string[]>(() => {
    // If --keep is provided, auto-select backups to delete
    if (keepCount !== null && backups.length > keepCount) {
      return backups.slice(keepCount).map((b) => b.path);
    }
    return [];
  });
  const [deletedCount, setDeletedCount] = useState(0);
  const [freedSpace, setFreedSpace] = useState(0);
  const retimer = useRetimer();

  const handleSubmit = (paths: string[]) => {
    if (paths.length > 0) {
      setSelectedPaths(paths);
      setStatus('confirming');
    } else {
      // No items selected; treat as cancelled
      onComplete?.();
    }
  };

  const handleConfirm = useCallback(() => {
    setStatus('deleting');

    const result = deleteBackups(selectedPaths);

    setDeletedCount(result.deletedCount);
    setFreedSpace(result.freedSpace);
    setStatus('done');
    if (!showReturnHint) {
      retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
    }
  }, [selectedPaths, showReturnHint, onComplete, retimer]);

  const handleCancel = useCallback(() => {
    setStatus('cancelled');
    if (!showReturnHint) {
      retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
    }
  }, [showReturnHint, onComplete, retimer]);

  // Listen for any key to return to main menu
  usePressAnyKey((status === 'done' || status === 'cancelled') && showReturnHint, () => {
    onComplete?.();
  });

  // Auto mode: if --keep is provided and backups need deletion, confirm directly
  useEffect(() => {
    if (keepCount !== null && status === 'confirming' && selectedPaths.length > 0) {
      // Give user time to see information
      retimer(setTimeout(() => handleConfirm(), AUTO_CONFIRM_DELAY));
    }
    return () => retimer();
  }, [status, selectedPaths.length, handleConfirm, keepCount, retimer]);

  // Auto-exit when no action is needed
  const shouldAutoExit = backups.length === 0 || (keepCount !== null && selectedPaths.length === 0);
  useEffect(() => {
    if (shouldAutoExit && !showReturnHint) {
      retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
    }
    return () => retimer();
  }, [shouldAutoExit, showReturnHint, onComplete, retimer]);

  if (backups.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No backup files found</Text>
        {showReturnHint && (
          <Box marginTop={1}>
            <Text dimColor>Press any key to return to main menu...</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (keepCount !== null && selectedPaths.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="green">
          Currently have {backups.length} backups; keeping {keepCount}; nothing to clean
        </Text>
        {showReturnHint && (
          <Box marginTop={1}>
            <Text dimColor>Press any key to return to main menu...</Text>
          </Box>
        )}
      </Box>
    );
  }

  const selectedBackups = backups.filter((b) => selectedPaths.includes(b.path));
  const totalSize = selectedBackups.reduce((sum, b) => sum + b.size, 0);

  return (
    <Box flexDirection="column">
      {status === 'selecting' && (
        <Box flexDirection="column">
          <Text>Select backups to delete (space to select, enter to confirm; enter with none selected cancels):</Text>
          <Box marginTop={1}>
            <MultiSelect
              options={backups.map((b) => ({
                label: `${b.name}  ${b.sizeFormatted}  ${b.type === 'full' ? '[full]' : '[basic]'}`,
                value: b.path,
              }))}
              onChange={setSelectedPaths}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>
      )}

      {status === 'confirming' && (
        <Box flexDirection="column">
          {keepCount !== null && (
            <Text>
              Keep most recent <Text color="green">{keepCount}</Text> backups; delete these{' '}
              <Text color="yellow">{selectedPaths.length}</Text>:
            </Text>
          )}
          {selectedBackups.map((b) => (
            <Text key={b.path}>
              <Text color="red">{'  '}- </Text>
              <Text>{b.name}</Text>
              <Text dimColor> ({b.sizeFormatted})</Text>
            </Text>
          ))}
          <Box marginTop={1}>
            <Text>
              Will free: <Text color="yellow">{formatSize(totalSize)}</Text>
            </Text>
          </Box>
          {keepCount === null && (
            <Box marginTop={1}>
              <Text color="yellow">Confirm deletion of {selectedPaths.length} backups?</Text>
              <Box marginLeft={1}>
                <ConfirmInput onConfirm={handleConfirm} onCancel={handleCancel} />
              </Box>
            </Box>
          )}
        </Box>
      )}

      {status === 'deleting' && (
        <Text>
          <Text color="yellow">Deleting...</Text>
        </Text>
      )}

      {status === 'done' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="green">
              Clean complete
            </Text>
          </Box>
          <Text>
            Deleted <Text color="green">{deletedCount}</Text> backups, freed{' '}
            <Text color="yellow">{formatSize(freedSpace)}</Text> space
          </Text>
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
    </Box>
  );
}
