import { useInput } from 'ink';

/** Hook for pressing any key to continue */
export function usePressAnyKey(enabled: boolean, onPress: () => void) {
  useInput(
    () => {
      onPress();
    },
    { isActive: enabled },
  );
}
