/** Internal implementation note. */
export type BackupType = 'full' | 'basic';

/** Internal implementation note. */
export const MANIFEST_NAME = 'astro-koharu-backup';

/** Internal implementation note. */
export const MANIFEST_FILENAME = 'manifest.json';

/** Internal implementation note. */
export const BACKUP_FILE_EXTENSION = '.tar.gz';

/** Internal implementation note. */
export const TEMP_DIR_PREFIX = '.tmp-backup-';

/** Internal implementation note. */
export interface BackupItem {
  /** Internal implementation note. */
  src: string;
  /** Internal implementation note. */
  dest: string;
  /** Internal implementation note. */
  label: string;
  /** Internal implementation note. */
  required: boolean;
  /** Internal implementation note. */
  pattern?: string;
}

/** Internal implementation note. */
export const BACKUP_ITEMS: BackupItem[] = [
  { src: 'src/content/blog', dest: 'content/blog', label: 'Blog posts', required: true },
  { src: 'config', dest: 'config', label: 'Site config', required: true },
  { src: 'src/pages', dest: 'pages', label: 'Standalone pages', required: true, pattern: '*.md' },
  { src: 'public/img', dest: 'img', label: 'User images', required: true },
  { src: '.env', dest: 'env', label: 'Environment variables', required: true },
  // Internal implementation note.
  { src: 'public/favicon.ico', dest: 'favicon.ico', label: 'Site icon', required: false },
  { src: 'src/assets/lqips.json', dest: 'assets/lqips.json', label: 'LQIP data', required: false },
  { src: 'src/assets/similarities.json', dest: 'assets/similarities.json', label: 'Similarity data', required: false },
  { src: 'src/assets/summaries.json', dest: 'assets/summaries.json', label: 'AI summary data', required: false },
];

/** Internal implementation note. */
export const RESTORE_MAP: Record<string, string> = Object.fromEntries(BACKUP_ITEMS.map((item) => [item.dest, item.src]));
