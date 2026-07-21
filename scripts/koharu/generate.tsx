import { Spinner, TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CycleSelect as Select } from './components';
import { AUTO_EXIT_DELAY } from './constants';
import { DEFAULT_LLM_MODEL, GENERATE_ITEMS, type GenerateType } from './constants/generate';
import { usePressAnyKey, useRetimer } from './hooks';
import { checkLlmServer, type RunScriptResult, runGenerate, runGenerateAll } from './utils/generate-operations';

type GenerateStatus = 'selecting' | 'model-input' | 'checking' | 'generating' | 'done' | 'error';
type GenerateSelection = GenerateType | 'all' | 'cancel';

interface GenerateAppProps {
  initialType?: GenerateType | 'all';
  initialModel?: string;
  force?: boolean;
  showReturnHint?: boolean;
  onComplete?: () => void;
}

export function GenerateApp({
  initialType,
  initialModel,
  force = false,
  showReturnHint = false,
  onComplete,
}: GenerateAppProps) {
  const [status, setStatus] = useState<GenerateStatus>(() => {
    if (initialType) {
      // If type is summaries or all, need model input (unless model provided)
      if ((initialType === 'summaries' || initialType === 'all') && !initialModel) {
        return 'model-input';
      }
      return 'checking';
    }
    return 'selecting';
  });
  const [selectedType, setSelectedType] = useState<GenerateSelection | null>(initialType || null);
  const [model, setModel] = useState(initialModel || DEFAULT_LLM_MODEL);
  const [results, setResults] = useState<Map<GenerateType, RunScriptResult>>(new Map());
  const [error, setError] = useState<string>('');
  const [currentTask, setCurrentTask] = useState<string>('');
  const retimer = useRetimer();
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  const needsLlm = selectedType === 'summaries' || selectedType === 'all';

  const handleTypeSelect = (value: string) => {
    if (value === 'cancel') {
      onComplete?.();
      return;
    }
    setSelectedType(value as GenerateSelection);
    // If summaries or all, need model input
    if (value === 'summaries' || value === 'all') {
      setStatus('model-input');
    } else {
      setStatus('checking');
    }
  };

  const handleModelSubmit = (value: string) => {
    setModel(value || DEFAULT_LLM_MODEL);
    setStatus('checking');
  };

  const executeGenerate = useCallback(async () => {
    try {
      setStatus('generating');

      if (selectedType === 'all') {
        // Run all generators with progress tracking
        const allResults = await runGenerateAll({
          model,
          force,
          onProgress: (label) => setCurrentTask(label),
        });

        // Check if cancelled during execution
        if (isUnmountedRef.current) return;

        setResults(allResults);

        // Check if any failed
        const failed = [...allResults.entries()].find(([, r]) => !r.success);
        if (failed) {
          setError(`Failed to generate ${GENERATE_ITEMS.find((i) => i.id === failed[0])?.label}`);
          setStatus('error');
        } else {
          setStatus('done');
        }
      } else if (selectedType && selectedType !== 'cancel') {
        // Run single generator
        const item = GENERATE_ITEMS.find((i) => i.id === selectedType);
        setCurrentTask(item?.label || '');

        const result = await runGenerate(selectedType, { model, force });

        // Check if cancelled during execution
        if (isUnmountedRef.current) return;

        setResults(new Map([[selectedType, result]]));

        if (!result.success) {
          setError(`Generation failed (exit code: ${result.code})`);
          setStatus('error');
        } else {
          setStatus('done');
        }
      }

      if (!showReturnHint) {
        retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
      }
    } catch (err) {
      if (isUnmountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      if (!showReturnHint) {
        retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
      }
    }
  }, [selectedType, model, force, showReturnHint, onComplete, retimer]);

  // Pre-flight check
  useEffect(() => {
    if (status !== 'checking') return;

    let cancelled = false;

    const check = async () => {
      if (needsLlm) {
        const llmAvailable = await checkLlmServer();
        if (cancelled) return;

        if (!llmAvailable) {
          setError('LLM server is not running. Start LM Studio, Ollama, or another LLM service first.');
          setStatus('error');
          if (!showReturnHint) {
            retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
          }
          return;
        }
      }
      if (!cancelled) {
        executeGenerate();
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [status, needsLlm, executeGenerate, showReturnHint, onComplete, retimer]);

  // Listen for key press to return to menu
  usePressAnyKey((status === 'done' || status === 'error') && showReturnHint, () => {
    onComplete?.();
  });

  const successCount = [...results.values()].filter((r) => r.success).length;
  const failedCount = [...results.values()].filter((r) => !r.success).length;

  return (
    <Box flexDirection="column">
      {status === 'selecting' && (
        <Box flexDirection="column">
          <Text>Select content to generate:</Text>
          <Select
            options={[
              ...GENERATE_ITEMS.map((item) => ({
                label: `${item.label} (${item.description})`,
                value: item.id,
              })),
              { label: 'Generate all', value: 'all' },
              { label: 'Back', value: 'cancel' },
            ]}
            onChange={handleTypeSelect}
          />
        </Box>
      )}

      {status === 'model-input' && (
        <Box flexDirection="column">
          <Text>Enter LLM model name:</Text>
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput defaultValue={DEFAULT_LLM_MODEL} onSubmit={handleModelSubmit} />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>(Press Enter to use default model: {DEFAULT_LLM_MODEL})</Text>
          </Box>
        </Box>
      )}

      {status === 'checking' && (
        <Box>
          <Spinner label={needsLlm ? 'Checking LLM server...' : 'Preparing...'} />
        </Box>
      )}

      {status === 'generating' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Spinner label={`Generating ${currentTask}...`} />
          </Box>
          <Text dimColor>Subprocess output will appear below:</Text>
          <Text dimColor>─────────────────────────────────</Text>
        </Box>
      )}

      {status === 'done' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="green">
              Generation complete
            </Text>
          </Box>
          {[...results.entries()].map(([type, result]) => {
            const item = GENERATE_ITEMS.find((i) => i.id === type);
            return (
              <Text key={type}>
                {result.success ? <Text color="green">{'  '}✓ </Text> : <Text color="red">{'  '}✗ </Text>}
                <Text>{item?.label}</Text>
              </Text>
            );
          })}
          <Box marginTop={1}>
            <Text>
              Succeeded: <Text color="green">{successCount}</Text>
              {failedCount > 0 && (
                <>
                  {' '}
                  Failed: <Text color="red">{failedCount}</Text>
                </>
              )}
            </Text>
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
            Generation failed
          </Text>
          <Text color="red">{error}</Text>
          {needsLlm && error.includes('LLM') && (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Tip: start LLM service and retry</Text>
              <Text dimColor>{'  '}• LM Studio: start app and load model</Text>
              <Text dimColor>{'  '}• Ollama: ollama serve</Text>
            </Box>
          )}
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
