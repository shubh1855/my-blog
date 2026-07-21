// Types

// Creators
export { FriendCreator } from './friend-creator';
export { PostCreator } from './post-creator';
export type { CategoryTreeItem, ContentCreator, CreatorProps, FriendData, PostData } from './types';

import { FriendCreator } from './friend-creator';
import { PostCreator } from './post-creator';
// Creator registry
import type { ContentCreator } from './types';

export const CREATORS: ContentCreator[] = [
  {
    id: 'post',
    label: 'Blog posts',
    description: 'Create a new blog post',
    Component: PostCreator,
  },
  {
    id: 'friend',
    label: 'Friend link',
    description: 'Add a new friend link',
    Component: FriendCreator,
  },
];

export type CreatorType = (typeof CREATORS)[number]['id'];
