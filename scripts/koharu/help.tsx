import { Box, Text } from 'ink';
import { useEffect } from 'react';
import { AUTO_EXIT_DELAY } from './constants';
import { usePressAnyKey, useRetimer } from './hooks';

interface HelpAppProps {
  showReturnHint?: boolean;
  onComplete?: () => void;
}

export function HelpApp({ showReturnHint = false, onComplete }: HelpAppProps) {
  const retimer = useRetimer();

  // Monitor key presses to return to the main menu
  usePressAnyKey(showReturnHint, () => {
    onComplete?.();
  });

  // If no return prompt is displayed, exit directly.
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
        <Text> pnpm koharu interactive main menu</Text>
        <Text> pnpm koharu new new content</Text>
        <Text> pnpm koharu backup backup blog content and config</Text>
        <Text> pnpm koharu restore restore from backup</Text>
        <Text> pnpm koharu generate generate content assets</Text>
        <Text> pnpm koharu migrate one-click migrate historical post data</Text>
        <Text> pnpm koharu clean clean old backups</Text>
        <Text> pnpm koharu list view all backups</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Backup options:</Text>
        <Text> --full full backup (includes all images and assets)</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Restore options:</Text>
        <Text> --latest restore latest backup</Text>
        <Text> --dry-run preview files to be restored</Text>
        <Text> --force skip confirmation prompt</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Clean options:</Text>
        <Text> --keep N keep recent N backups, delete the rest</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Generate options:</Text>
        <Text> pnpm koharu generate lqips generate LQIP placeholders</Text>
        <Text> pnpm koharu generate similarities generate similarity vectors</Text>
        <Text> pnpm koharu generate summaries generate AI summaries</Text>
        <Text> pnpm koharu generate all generate all</Text>
        <Text> --model {'<name>'} specify LLM model</Text>
        <Text> --force force regenerate</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Migration options:</Text>
        <Text> --dry-run only scan and preview migration content</Text>
        <Text> --force skip confirmation prompt (will still auto-backup)</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Update options:</Text>
        <Text> --check only check for updates (do not execute)</Text>
        <Text> --skip-backup skip backup step</Text>
        <Text> --force skip confirmation prompt</Text>
        <Text> --tag {'<version>'} specify target version (e.g. v2.0.0)</Text>
        <Text> --rebase use rebase mode (rewrite history, forced backup)</Text>
        <Text> --clean use clean mode (zero conflicts, forced backup)</Text>
        <Text> --dry-run preview operations (do not actually execute)</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>New options:</Text>
        <Text> pnpm koharu new interactive select content type</Text>
        <Text> pnpm koharu new post new blog post</Text>
        <Text> pnpm koharu new friend new friend link</Text>
      </Box>

      <Box flexDirection="column">
        <Text bold>General options:</Text>
        <Text> --help, -h show help information</Text>
      </Box>

      {showReturnHint && (
        <Box marginTop={1}>
          <Text dimColor>Press any key to return to main menu...</Text>
        </Box>
      )}
    </Box>
  );
}
