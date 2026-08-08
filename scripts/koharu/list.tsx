import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import { AUTO_EXIT_DELAY, BACKUP_DIR } from './constants';
import { usePressAnyKey, useRetimer } from './hooks';
import { type BackupInfo, getBackupList } from './utils';

interface ListAppProps {
  showReturnHint?: boolean;
  onComplete?: () => void;
}

export function ListApp({ showReturnHint = false, onComplete }: ListAppProps) {
  const [backups] = useState<BackupInfo[]>(() => getBackupList());
  const retimer = useRetimer();

  // Listen for any key to return to main menu
  usePressAnyKey(showReturnHint, () => {
    onComplete?.();
  });

  // Exit directly if return hint is hidden
  useEffect(() => {
    if (!showReturnHint) {
      retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
    }
    return () => retimer();
  }, [showReturnHint, onComplete, retimer]);

  if (backups.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No backup files found</Text>
        <Box marginTop={1}>
          <Text dimColor>Backup directory: {BACKUP_DIR}</Text>
        </Box>
        <Text dimColor>Use 'pnpm koharu backup' to create a backup</Text>
        {showReturnHint && (
          <Box marginTop={1}>
            <Text dimColor>Press any key to return to main menu...</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {backups.map((backup) => (
          <Box key={backup.name}>
            <Text color="green">{'  '}* </Text>
            <Text>{backup.name}</Text>
            <Text color="yellow"> {backup.sizeFormatted}</Text>
            {backup.type === 'full' && <Text color="cyan"> [full]</Text>}
            {backup.type === 'basic' && <Text color="green"> [basic]</Text>}
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Total backups: {backups.length}</Text>
      </Box>
      {showReturnHint && (
        <Box marginTop={1}>
          <Text dimColor>Press any key to return to main menu...</Text>
        </Box>
      )}
    </Box>
  );
}
