// Import YAML config directly - processed by @rollup/plugin-yaml

import type { FriendLink } from '@lib/config/types';
import yamlConfig from '../../config/site.yaml';

// Re-export type for backwards compatibility
export type { FriendLink };

export const friendsData: FriendLink[] = yamlConfig.friends?.data ?? [];
