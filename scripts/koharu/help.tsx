import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { AUTO_EXIT_DELAY, usePressAnyKey, useRetimer } from './shared';

interface HelpAppProps {
  showReturnHint?: boolean;
  onComplete?: () => void;
}

export function HelpApp({ showReturnHint = false, onComplete }: HelpAppProps) {
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

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Usage:</Text>
        <Text> pnpm koharu Interactive main menu</Text>
        <Text> pnpm koharu new Create new content</Text>
        <Text> pnpm koharu backup Backup blog content and configuration</Text>
        <Text> pnpm koharu restore Restore from backup</Text>
        <Text> pnpm koharu generate Generate content assets</Text>
        <Text> pnpm koharu clean Clean old backups</Text>
        <Text> pnpm koharu list View all backups</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Backup options:</Text>
        <Text> --full Full backup (includes all images and assets)</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Restore options:</Text>
        <Text> --latest Restore latest backup</Text>
        <Text> --dry-run Preview files to be restored</Text>
        <Text> --force Skip confirmation prompts</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Clean options:</Text>
        <Text> --keep N Keep the most recent N backups and delete the rest</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Generate options:</Text>
        <Text> pnpm koharu generate lqips Generate LQIP placeholders</Text>
        <Text> pnpm koharu generate similarities Generate similarity vectors</Text>
        <Text> pnpm koharu generate summaries Generate AI summaries</Text>
        <Text> pnpm koharu generate all Generate all</Text>
        <Text> --model {'<name>'} Specify LLM model</Text>
        <Text> --force Force regeneration</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Update options:</Text>
        <Text> --check Check for updates only (do not execute)</Text>
        <Text> --skip-backup Skip backup step</Text>
        <Text> --force Skip confirmation prompts</Text>
        <Text> --tag {'<version>'} Specify target version (e.g. v2.0.0)</Text>
        <Text> --rebase Use rebase mode (rewrites history, forces backup)</Text>
        <Text> --clean Use clean mode (zero conflicts, forces backup)</Text>
        <Text> --dry-run Preview operation (do not execute)</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>New content options:</Text>
        <Text> pnpm koharu new Interactive content type selection</Text>
        <Text> pnpm koharu new post Create new blog post</Text>
        <Text> pnpm koharu new friend Create new friend link</Text>
      </Box>

      <Box flexDirection="column">
        <Text bold>General options:</Text>
        <Text> --help, -h Display help information</Text>
      </Box>

      {showReturnHint && (
        <Box marginTop={1}>
          <Text dimColor>Press any key to return to main menu...</Text>
        </Box>
      )}
    </Box>
  );
}
