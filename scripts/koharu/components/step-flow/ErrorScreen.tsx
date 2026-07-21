import { Box, Text } from 'ink';

export interface ErrorScreenProps {
  title: string;
  error: string;
  showReturnHint?: boolean;
}

export function ErrorScreen({ title, error, showReturnHint }: ErrorScreenProps) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      <Text bold color="red">
        Operation failed
      </Text>
      <Text color="red">{error}</Text>
      {showReturnHint && (
        <Box marginTop={1}>
          <Text dimColor>Press any key to return to main menu...</Text>
        </Box>
      )}
    </Box>
  );
}
