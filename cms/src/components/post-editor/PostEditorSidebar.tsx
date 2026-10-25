import { Icon } from '@iconify/react';
import type { Ref } from 'react';
import { EditorTOC } from '@/components/EditorTOC';
import { FrontmatterEditor, type FrontmatterEditorRef } from '@/components/FrontmatterEditor';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import type { EditorHeading } from '@/hooks/useEditorHeadings';
import { cn } from '@/lib/utils';
import type { BlogSchema } from '@/types';

export type SidebarTab = 'frontmatter' | 'toc' | 'preview';

const SIDEBAR_TABS = [
  { id: 'frontmatter', icon: 'ri:settings-3-line', label: 'Metadata' },
  { id: 'toc', icon: 'ri:list-unordered', label: 'Outline' },
  { id: 'preview', icon: 'ri:eye-line', label: 'Preview' },
] as const;

interface PostEditorSidebarProps {
  width: number;
  overlay: boolean;
  activeTab: SidebarTab;
  frontmatter: BlogSchema;
  frontmatterRef: Ref<FrontmatterEditorRef>;
  headings: EditorHeading[];
  previewContent: string;
  onTabChange: (tab: SidebarTab) => void;
  onFrontmatterChange: (frontmatter: BlogSchema) => void;
  onCategoriesChange: (categories: string[]) => void;
  onTOCNavigate: (blockId: string) => void;
}

export function PostEditorSidebar({
  width,
  overlay,
  activeTab,
  frontmatter,
  frontmatterRef,
  headings,
  previewContent,
  onTabChange,
  onFrontmatterChange,
  onCategoriesChange,
  onTOCNavigate,
}: PostEditorSidebarProps) {
  return (
    <aside style={{ width: overlay ? '100%' : width }} className="flex h-full shrink-0 flex-col border-border border-l bg-card">
      <div className="flex border-border border-b">
        {SIDEBAR_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 px-3 py-2.5 font-medium text-sm transition-colors',
              activeTab === tab.id
                ? 'border-primary border-b-2 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon icon={tab.icon} className="mr-1 inline-block size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <div hidden={activeTab !== 'frontmatter'}>
          <FrontmatterEditor
            ref={frontmatterRef}
            frontmatter={frontmatter}
            onChange={onFrontmatterChange}
            onCategoriesChange={onCategoriesChange}
          />
        </div>
        {activeTab === 'toc' && (
          <div className="p-4">
            <EditorTOC headings={headings} onNavigate={onTOCNavigate} />
          </div>
        )}
        {activeTab === 'preview' && (
          <div className="p-4">
            <MarkdownPreview content={previewContent} />
          </div>
        )}
      </div>
    </aside>
  );
}
