import fs from 'node:fs';
import path from 'node:path';
import { Box, render, Text, useApp } from 'ink';
import { useState } from 'react';
import { BackupApp } from './koharu/backup.js';
import { CleanApp } from './koharu/clean.js';
import { CycleSelect as Select } from './koharu/components';
import { BACKUP_DIR } from './koharu/constants';
import { GenerateApp } from './koharu/generate.js';
import { HelpApp } from './koharu/help.js';
import { ListApp } from './koharu/list.js';
import { MigrateApp } from './koharu/migrate.js';
import { NewApp } from './koharu/new.js';
import { RestoreApp } from './koharu/restore.js';
import { UpdateApp } from './koharu/update.js';
import { getBackupList, parseArgs } from './koharu/utils';

const args = parseArgs();

// 显示帮助
if (args.help) {
  console.log(`
koharu - astro-koharu CLI

Usage:
  pnpm koharu              交互式主菜单
  pnpm koharu backup       备份博客内容和配置
  pnpm koharu restore      从备份恢复
  pnpm koharu update       Update主题
  pnpm koharu clean        清理旧备份
  pnpm koharu list         查看所有备份
  pnpm koharu generate     生成内容资产
  pnpm koharu migrate      一键迁移历史文章数据
  pnpm koharu new          新建内容

Backup options:
  --full                   完整备份（包含所有图片和资产）

Restore options:
  --latest                 还原最新备份
  --dry-run                预览Will要还原的文件
  --force                  跳过确认提示

Update options:
  --check                  仅检查Update（不执行）
  --skip-backup            跳过备份步骤
  --force                  跳过确认提示
  --tag <version>          指定目标版本（如 v2.0.0）
  --rebase                 使用 rebase 模式（重写历史，强制备份）
  --clean                  使用 clean 模式（零冲突，强制备份）
  --dry-run                预览操作（不实际执行）

Clean options:
  --keep N                 保留最近 N 个备份，删除其余

Generate options:
  pnpm koharu generate lqips        生成 LQIP 图片占位符
  pnpm koharu generate similarities generate similarity vectors
  pnpm koharu generate summaries    生成 AI 摘要
  pnpm koharu generate all          生成全部
  --model <name>                    指定 LLM 模型 (用于 summaries)
  --force                           强制重新生成 (用于 summaries)

New options:
  pnpm koharu new                   交互式选择内容类型
  pnpm koharu new post              新建Blog post
  pnpm koharu new friend            新建友情链接

Migration options:
  --dry-run                仅扫描并预览迁移内容
  --check                  仅扫描，需要迁移时返回非零状态
  --force                  跳过确认提示（仍会自动备份）

General options:
  --help, -h               显示帮助信息
`);
  process.exit(0);
}

type AppMode = 'menu' | 'backup' | 'restore' | 'update' | 'clean' | 'list' | 'help' | 'generate' | 'migrate' | 'new';

function KoharuApp() {
  const { exit } = useApp();
  // 判断是否从主菜单进入（没有命令行参数）
  const [fromMenu] = useState(() => !args.command);
  const [mode, setMode] = useState<AppMode>(() => {
    // 根据命令行参数决定初始模式
    if (args.command === 'backup') return 'backup';
    if (args.command === 'restore') return 'restore';
    if (args.command === 'update') return 'update';
    if (args.command === 'clean') return 'clean';
    if (args.command === 'list') return 'list';
    if (args.command === 'help') return 'help';
    if (args.command === 'generate') return 'generate';
    if (args.command === 'migrate') return 'migrate';
    if (args.command === 'new') return 'new';
    return 'menu';
  });

  const handleComplete = () => {
    if (fromMenu) {
      // 从主菜单进入的，返回主菜单
      setMode('menu');
    } else {
      // 命令行直接进入的，完成后Exit
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

  // 获取还原用的备份文件
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
              { label: 'Backup - Backup blog content and config', value: 'backup' },
              { label: 'Restore - Restore from backup', value: 'restore' },
              { label: 'Update - Update theme', value: 'update' },
              { label: 'Generate - Generate content assets (LQIP, Similarity, Summary)', value: 'generate' },
              { label: 'Migrate - Compatibility for historical posts and old backups', value: 'migrate' },
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

      {mode === 'migrate' && (
        <MigrateApp
          check={args.check}
          dryRun={args.dryRun}
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
