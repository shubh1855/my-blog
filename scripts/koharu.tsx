import fs from 'node:fs';
import path from 'node:path';
import { Box, render, Text, useApp } from 'ink';
import { useState } from 'react';
import { BackupApp } from './koharu/backup.js';
import { CleanApp } from './koharu/clean.js';
import { CycleSelect as Select } from './koharu/components';
import { GenerateApp } from './koharu/generate.js';
import { HelpApp } from './koharu/help.js';
import { ListApp } from './koharu/list.js';
import { NewApp } from './koharu/new.js';
import { RestoreApp } from './koharu/restore.js';
import { BACKUP_DIR, getBackupList, parseArgs } from './koharu/shared.js';
import { UpdateApp } from './koharu/update.js';

const args = parseArgs();

// Display help
if (args.help) {
  console.log(`
koharu - astro-koharu CLI

Usage:
  pnpm koharu              Interactive main menu
  pnpm koharu backup       Backup blog content and configuration
  pnpm koharu restore      Restore from backup
  pnpm koharu update       Update theme
  pnpm koharu clean        Clean old backups
  pnpm koharu list         View all backups
  pnpm koharu generate     Generate content assets
  pnpm koharu new          Create new content

Backup options:
  --full                   Full backup (includes all images and assets)

Restore options:
  --latest                 Restore latest backup
  --dry-run                Preview files to be restored
  --force                  Skip confirmation prompts

Update options:
  --check                  Check for updates only (do not execute)
  --skip-backup            Skip backup step
  --force                  Skip confirmation prompts
  --tag <version>          Specify target version (e.g. v2.0.0)
  --rebase                 Use rebase mode (rewrites history, forces backup)
  --clean                  Use clean mode (zero conflicts, forces backup)
  --dry-run                Preview operation (do not execute)

Clean options:
  --keep N                 Keep the most recent N backups and delete the rest

Generate options:
  pnpm koharu generate lqips        Generate LQIP image placeholders
  pnpm koharu generate similarities Generate similarity vectors
  pnpm koharu generate summaries    Generate AI summaries
  pnpm koharu generate all          Generate all
  --model <name>                    Specify LLM model (for summaries)
  --force                           Force regeneration (for summaries)

New content options:
  pnpm koharu new                   Interactive content type selection
  pnpm koharu new post              Create new blog post
  pnpm koharu new friend            Create new friend link

General options:
  --help, -h               Display help information
`);
  process.exit(0);
}

type AppMode = 'menu' | 'backup' | 'restore' | 'update' | 'clean' | 'list' | 'help' | 'generate' | 'new';

function KoharuApp() {
  const { exit } = useApp();
  // Determine whether entered from main menu (no command-line arguments)
  const [fromMenu] = useState(() => !args.command);
  const [mode, setMode] = useState<AppMode>(() => {
    // Determine initial mode from command-line arguments
    if (args.command === 'backup') return 'backup';
    if (args.command === 'restore') return 'restore';
    if (args.command === 'update') return 'update';
    if (args.command === 'clean') return 'clean';
    if (args.command === 'list') return 'list';
    if (args.command === 'help') return 'help';
    if (args.command === 'generate') return 'generate';
    if (args.command === 'new') return 'new';
    return 'menu';
  });

  const handleComplete = () => {
    if (fromMenu) {
      // Entered from main menu; return to main menu
      setMode('menu');
    } else {
      // Entered directly from command line; exit after completion
      setTimeout(() => exit(), 100);
    }
  };

  const handleMenuSelect = (value: string) => {
    if (value === 'exit') {
      exit();
      return;
    }
    setMode(value as AppMode);
  };

  // Get backup file for restore
  const getRestoreBackupFile = (): string | undefined => {
    if (args.latest) {
      const backups = getBackupList();
      if (backups.length > 0) {
        return backups[0].path;
      }
    } else if (args.backupFile) {
      if (fs.existsSync(args.backupFile)) {
        return args.backupFile;
      }
      const inBackupDir = path.join(BACKUP_DIR, args.backupFile);
      if (fs.existsSync(inBackupDir)) {
        return inBackupDir;
      }
    }
    return undefined;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">
          koharu
        </Text>
        <Text dimColor> - astro-koharu CLI</Text>
      </Box>

      {mode === 'menu' && (
        <Box flexDirection="column">
          <Text>Please select an operation:</Text>
          <Select
            visibleOptionCount={10}
            options={[
              { label: 'New - Create blog post or friend link', value: 'new' },
              { label: 'Backup - Backup blog content and configuration', value: 'backup' },
              { label: 'Restore - Restore from backup', value: 'restore' },
              { label: 'Update - Update theme', value: 'update' },
              { label: 'Generate - Generate content assets (LQIP, similarities, summaries)', value: 'generate' },
              { label: 'Clean - Clean old backups', value: 'clean' },
              { label: 'List - View all backups', value: 'list' },
              { label: 'Help - View command usage', value: 'help' },
              { label: 'Exit', value: 'exit' },
            ]}
            onChange={handleMenuSelect}
          />
        </Box>
      )}

      {mode === 'backup' && <BackupApp initialFull={args.full} showReturnHint={fromMenu} onComplete={handleComplete} />}

      {mode === 'restore' && (
        <RestoreApp
          initialBackupFile={getRestoreBackupFile()}
          dryRun={args.dryRun}
          force={args.force}
          showReturnHint={fromMenu}
          onComplete={handleComplete}
        />
      )}

      {mode === 'update' && (
        <UpdateApp
          checkOnly={args.check}
          skipBackup={args.skipBackup}
          force={args.force}
          targetTag={args.tag || undefined}
          rebase={args.rebase}
          dryRun={args.dryRun}
          clean={args.clean}
          showReturnHint={fromMenu}
          onComplete={handleComplete}
        />
      )}

      {mode === 'clean' && <CleanApp keepCount={args.keep} showReturnHint={fromMenu} onComplete={handleComplete} />}

      {mode === 'list' && <ListApp showReturnHint={fromMenu} onComplete={handleComplete} />}

      {mode === 'help' && <HelpApp showReturnHint={fromMenu} onComplete={handleComplete} />}

      {mode === 'generate' && (
        <GenerateApp
          initialType={args.generateType || undefined}
          initialModel={args.model || undefined}
          force={args.force}
          showReturnHint={fromMenu}
          onComplete={handleComplete}
        />
      )}

      {mode === 'new' && (
        <NewApp initialType={args.newType || undefined} showReturnHint={fromMenu} onComplete={handleComplete} />
      )}
    </Box>
  );
}

render(<KoharuApp />);
