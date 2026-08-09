import { ConfirmInput, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';

import { AUTO_EXIT_DELAY } from './constants';
import { usePressAnyKey, useRetimer } from './hooks';
import { applyContentMigration, type ContentMigrationPlan, planContentMigration, runBackup } from './utils';

type MigrationStatus = 'confirming' | 'backing-up' | 'migrating' | 'done' | 'error' | 'cancelled';

interface MigrateAppProps {
  check?: boolean;
  dryRun?: boolean;
  force?: boolean;
  showReturnHint?: boolean;
  onComplete?: () => void;
}

const ACTION_LABELS = {
  'add-link': 'Add link',
  'rename-slug': 'slug changed to link',
  'remove-slug': 'Remove redundant slug',
} as const;

export function MigrateApp({
  check = false,
  dryRun = false,
  force = false,
  showReturnHint = false,
  onComplete,
}: MigrateAppProps) {
  const [plan, setPlan] = useState<ContentMigrationPlan>(() => planContentMigration());
  const [status, setStatus] = useState<MigrationStatus>(() =>
    check || dryRun || plan.changes.length === 0 || plan.errors.length > 0 ? 'done' : 'confirming',
  );
  const [backupFile, setBackupFile] = useState('');
  const [error, setError] = useState('');
  const retimer = useRetimer();

  const finishLater = useCallback(() => {
    if (!showReturnHint) retimer(setTimeout(() => onComplete?.(), AUTO_EXIT_DELAY));
  }, [onComplete, retimer, showReturnHint]);

  const runMigration = useCallback(() => {
    try {
      setStatus('backing-up');
      const backup = runBackup(false);
      setBackupFile(backup.backupFile);
      setStatus('migrating');
      const freshPlan = planContentMigration();
      setPlan(freshPlan);
      if (freshPlan.errors.length > 0) {
        const firstIssue = freshPlan.errors[0];
        throw new Error(
          `Rescan after backup found ${freshPlan.errors.length} issues, no files modified. ${firstIssue.file}: ${firstIssue.message}`,
        );
      }
      applyContentMigration(freshPlan);
      setStatus('done');
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : String(migrationError));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (status === 'done' || status === 'error' || status === 'cancelled') finishLater();
  }, [finishLater, status]);

  // In non-interactive CLI runs, surface failures through the exit code so scripts and CI can detect them.
  // Check mode also fails when safe migrations are pending. The interactive menu never fails the process.
  useEffect(() => {
    if (showReturnHint) return;
    if (status === 'error' || (status === 'done' && (plan.errors.length > 0 || (check && plan.changes.length > 0)))) {
      process.exitCode = 1;
    }
  }, [check, plan.changes.length, plan.errors.length, showReturnHint, status]);

  useEffect(() => {
    if (force && status === 'confirming') runMigration();
  }, [force, runMigration, status]);

  const handleCancel = useCallback(() => {
    setStatus('cancelled');
  }, []);

  usePressAnyKey((status === 'done' || status === 'error' || status === 'cancelled') && showReturnHint, () => {
    onComplete?.();
  });

  return (
    <Box flexDirection="column">
      {(status === 'confirming' || status === 'done') && (
        <Box flexDirection="column">
          <Text bold>Content migration check</Text>
          <Text>
            Scanned <Text color="cyan">{plan.scannedFiles}</Text> posts, need migration{' '}
            <Text color={plan.changes.length > 0 ? 'yellow' : 'green'}>{plan.changes.length}</Text> posts
          </Text>
          {plan.changes.slice(0, 10).map((change) => (
            <Text key={change.file} dimColor>
              {'  '}- {change.file} ({ACTION_LABELS[change.action]})
            </Text>
          ))}
          {plan.changes.length > 10 && (
            <Text dimColor>
              {'  '}... plus {plan.changes.length - 10} posts
            </Text>
          )}

          {plan.errors.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="red" bold>
                Found {plan.errors.length} issues, no files modified
              </Text>
              {plan.errors.slice(0, 5).map((issue) => (
                <Text key={`${issue.file}:${issue.message}`} color="red">
                  {'  '}- {issue.file}: {issue.message}
                </Text>
              ))}
            </Box>
          )}

          {status === 'confirming' && (
            <Box flexDirection="column" marginTop={1}>
              <Text>A basic backup will be created before migration. Confirm execution?</Text>
              {!force && <ConfirmInput onConfirm={runMigration} onCancel={handleCancel} />}
            </Box>
          )}

          {status === 'done' && plan.errors.length === 0 && !check && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="green">
                {dryRun
                  ? 'Preview completed, no files modified'
                  : plan.changes.length === 0
                    ? 'No migration needed'
                    : 'Migration completed'}
              </Text>
              {backupFile && <Text dimColor>Backup file: {backupFile}</Text>}
            </Box>
          )}

          {status === 'done' && check && (
            <Box flexDirection="column" marginTop={1}>
              {plan.errors.length === 0 && plan.changes.length === 0 ? (
                <Text bold color="green">
                  Content migration check passed
                </Text>
              ) : (
                <>
                  <Text bold color="red">
                    Content migration not complete, prevented startup or build
                  </Text>
                  <Text color="yellow">{'  '}Preview first: pnpm koharu migrate --dry-run</Text>
                  <Text color="yellow">{'  '}Then execute: pnpm koharu migrate</Text>
                </>
              )}
            </Box>
          )}
        </Box>
      )}

      {status === 'backing-up' && <Spinner label="Backing up user content..." />}
      {status === 'migrating' && <Spinner label="Migrating post links..." />}

      {status === 'cancelled' && <Text color="yellow">Cancelled</Text>}
      {status === 'error' && (
        <Box flexDirection="column">
          <Text bold color="red">
            Migration failed
          </Text>
          <Text color="red">{error}</Text>
          {backupFile && <Text dimColor>Can be restored from backup: {backupFile}</Text>}
        </Box>
      )}

      {(status === 'done' || status === 'error' || status === 'cancelled') && showReturnHint && (
        <Box marginTop={1}>
          <Text dimColor>Press any key to return to main menu...</Text>
        </Box>
      )}
    </Box>
  );
}
