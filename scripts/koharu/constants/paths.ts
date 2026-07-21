import path from 'node:path';

/** Internal implementation note. */
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

/** Internal implementation note. */
export const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');

/** Internal implementation note. */
export const SITE_CONFIG_PATH = path.join(PROJECT_ROOT, 'config/site.yaml');

/** Internal implementation note. */
export const BLOG_CONTENT_PATH = path.join(PROJECT_ROOT, 'src/content/blog');
