/**
 * Post Editor
 *
 * Full-screen editor for blog posts with BlockNote editor and frontmatter panel.
 * Supports Cmd+S save, new category detection, and unsaved changes warning.
 */

import { useCreateBlockNote } from '@blocknote/react';
import '@blocknote/shadcn/style.css';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CategoryMappingDialog } from '@/components/CategoryMappingDialog';
import type { FrontmatterEditorRef } from '@/components/FrontmatterEditor';
import { blocksToMarkdown, markdownToBlocks, postEditorSchema } from '@/components/post-editor/editor';
import { PostEditorCanvas } from '@/components/post-editor/PostEditorCanvas';
import { PostEditorHeader } from '@/components/post-editor/PostEditorHeader';
import { PostEditorSidebar, type SidebarTab } from '@/components/post-editor/PostEditorSidebar';
import { SidebarResizeHandle } from '@/components/post-editor/SidebarResizeHandle';
import { useSidebarResize } from '@/components/post-editor/useSidebarResize';
import { Button } from '@/components/ui/button';
import { useEditorHeadings } from '@/hooks';
import { readPost, writePost } from '@/lib/api';
import { detectNewCategories, getCategoryMap, setCategoryMap } from '@/lib/category';
import { DEV_SERVER_URL } from '@/lib/config';
import type { BlogSchema } from '@/types';

interface PostEditorProps {
  postId: string;
  onClose: () => void;
  onSaved?: () => void;
}

function hasSourceSensitiveMarkdown(markdown: string): boolean {
  let fence: { marker: string; character: string } | undefined;
  for (const line of markdown.split('\n')) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fenceMatch?.[1]) {
      if (!fence && /\btitle\s*(?:=|:)/i.test(fenceMatch[2] ?? '')) return true;
      if (!fence) fence = { marker: fenceMatch[1], character: fenceMatch[1].charAt(0) };
      else if (
        fenceMatch[1]?.[0] === fence.character &&
        fenceMatch[1].length >= fence.marker.length &&
        !(fenceMatch[2] ?? '').trim()
      ) {
        fence = undefined;
      }
      continue;
    }
    if (!fence && (/^\s*(?:::|\+\+\+|;;;)/.test(line) || /<\/?[A-Za-z][A-Za-z0-9:-]*(?=\s|\/?>)[^>]*>/i.test(line))) {
      return true;
    }
  }
  return false;
}

export function PostEditor({ postId, onClose, onSaved }: PostEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('frontmatter');
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 639px)').matches);

  const { sidebarWidth, isResizing, startResizing, handleResizeKeyDown } = useSidebarResize();

  const [frontmatter, setFrontmatter] = useState<BlogSchema>({ title: '' });
  const frontmatterRef = useRef<FrontmatterEditorRef>(null);

  const [previewContent, setPreviewContent] = useState('');

  const [currentCategories, setCurrentCategories] = useState<string[]>([]);
  const [pendingCategoryMappings, setPendingCategoryMappings] = useState<Record<string, string>>({});
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);

  // BlockNote editor with code block language support
  const editor = useCreateBlockNote({ schema: postEditorSchema });
  const initialContentLoaded = useRef(false);
  const initialFrontmatterLoaded = useRef(false);
  const originalContent = useRef('');
  const initialDocument = useRef('');
  const importedMarkdown = useRef('');
  const contentChanged = useRef(false);
  const revision = useRef(0);
  const saveInFlight = useRef(false);

  const headings = useEditorHeadings(editor);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Load post data
  useEffect(() => {
    async function loadPost() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await readPost(postId);
        setFrontmatter(data.frontmatter);
        initialFrontmatterLoaded.current = true;
        originalContent.current = data.content;

        // Load content into editor
        if (data.content && editor) {
          await markdownToBlocks(editor, data.content);
        }
        importedMarkdown.current = (await blocksToMarkdown(editor)).trimEnd();
        initialDocument.current = JSON.stringify(editor.document);
        // Empty Markdown is a valid loaded document too.
        initialContentLoaded.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [postId, editor]);

  // Track content changes
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.onChange(() => {
      // Only mark as changed after initial content is loaded
      if (initialContentLoaded.current) {
        const changed = JSON.stringify(editor.document) !== initialDocument.current;
        if (!changed && !contentChanged.current) return;
        contentChanged.current = changed;
        revision.current += 1;
        setHasUnsavedChanges(true);
      }
    });

    return unsubscribe;
  }, [editor]);

  // Handle frontmatter changes
  const handleFrontmatterChange = useCallback((fm: BlogSchema) => {
    setFrontmatter(fm);
    // Only mark as changed after initial frontmatter is loaded
    if (initialFrontmatterLoaded.current) {
      revision.current += 1;
      setHasUnsavedChanges(true);
    }
  }, []);

  // Handle categories change for new category detection
  const handleCategoriesChange = useCallback((categories: string[]) => {
    setCurrentCategories(categories);
  }, []);

  // Actual save operation (defined first so handleSave can reference it)
  const performSave = useCallback(
    async (categoryMappings?: Record<string, string>) => {
      if (!editor || saveInFlight.current) return;

      saveInFlight.current = true;
      const savedRevision = revision.current;
      try {
        const converted = contentChanged.current ? await blocksToMarkdown(editor) : null;
        const bodyChanged = converted !== null && converted.trimEnd() !== importedMarkdown.current;
        if (
          bodyChanged &&
          hasSourceSensitiveMarkdown(originalContent.current) &&
          !window.confirm(
            'This post contains Markdown that the visual editor may change or remove (custom containers, titled code fences, or raw HTML). Continue saving the edited body? Cancel to keep the original source unchanged.',
          )
        )
          return;
        setIsSaving(true);
        const content = bodyChanged ? converted : originalContent.current;

        // Update the updated date
        const now = new Date();
        const updatedFrontmatter = {
          ...frontmatter,
          updated: now,
          // Set date if not present (new post)
          date: frontmatter.date || now,
        };

        if (frontmatterRef.current && !(await frontmatterRef.current.validate())) {
          setShowSidebar(true);
          setSidebarTab('frontmatter');
          toast.error('Please fix the highlighted frontmatter fields before saving.');
          return;
        }

        await writePost(postId, updatedFrontmatter, content, categoryMappings);

        // Update category map if we added new mappings
        if (categoryMappings) {
          const currentMap = getCategoryMap();
          setCategoryMap({ ...currentMap, ...categoryMappings });
        }

        if (revision.current === savedRevision) setHasUnsavedChanges(false);
        toast.success('Post saved successfully');
        onSaved?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save post');
      } finally {
        saveInFlight.current = false;
        setIsSaving(false);
      }
    },
    [editor, frontmatter, postId, onSaved],
  );

  // Save post with new category detection
  const handleSave = useCallback(async () => {
    if (!editor || saveInFlight.current || isSaving) return;

    // Check for new categories
    const newCats = detectNewCategories(currentCategories);
    if (Object.keys(newCats).length > 0) {
      setPendingCategoryMappings(newCats);
      setShowCategoryDialog(true);
      return;
    }

    await performSave();
  }, [editor, currentCategories, performSave, isSaving]);

  // Handle category mapping confirmation
  const handleCategoryMappingConfirm = useCallback(
    (mappings: Record<string, string>) => {
      setShowCategoryDialog(false);
      performSave(mappings);
    },
    [performSave],
  );

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  const previewSlug = frontmatter.link || postId.replace(/\.mdx?$/, '');
  const previewUrl = `${DEV_SERVER_URL}/post/${previewSlug}`;

  // Handle TOC navigation
  const handleTOCNavigate = useCallback(
    (blockId: string) => {
      if (!editor) return;

      // Set cursor position and focus
      editor.setTextCursorPosition(blockId);
      editor.focus();

      // Scroll block into view after cursor position is set
      // BlockNote renders blocks with data-id attribute
      requestAnimationFrame(() => {
        const blockElement = document.querySelector(`[data-id="${blockId}"]`);
        if (blockElement) {
          blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    },
    [editor],
  );

  // Handle sidebar tab change
  const handleTabChange = useCallback(
    async (tab: SidebarTab) => {
      if (tab === 'preview' && editor) {
        // Convert blocks to markdown when switching to preview
        const md = await blocksToMarkdown(editor);
        setPreviewContent(md);
      }
      setSidebarTab(tab);
    },
    [editor],
  );

  // Keep the preview current when the canvas changes while the preview tab is open.
  useEffect(() => {
    if (!editor || sidebarTab !== 'preview') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let updateId = 0;
    const unsubscribe = editor.onChange(() => {
      if (timer) clearTimeout(timer);
      const currentUpdate = ++updateId;
      timer = setTimeout(() => {
        blocksToMarkdown(editor).then((markdown) => {
          if (currentUpdate === updateId) setPreviewContent(markdown);
        });
      }, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [editor, sidebarTab]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Icon icon="ri:loader-4-line" className="size-12 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Icon icon="ri:error-warning-line" className="size-12 text-destructive" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <PostEditorHeader
        title={frontmatter.title}
        postId={postId}
        previewUrl={previewUrl}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        showSidebar={showSidebar}
        onClose={handleClose}
        onSave={handleSave}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />

      <div className="relative flex flex-1 overflow-hidden">
        <div className={isNarrow && showSidebar ? 'hidden' : 'min-w-0 flex-1'}>
          <PostEditorCanvas editor={editor} />
        </div>

        {showSidebar && !isNarrow && (
          <SidebarResizeHandle
            width={sidebarWidth}
            isResizing={isResizing}
            onMouseDown={startResizing}
            onKeyDown={handleResizeKeyDown}
          />
        )}

        <div
          className={
            showSidebar ? (isNarrow ? 'absolute inset-0 z-30 bg-background' : 'relative flex min-h-0 shrink-0') : 'hidden'
          }
        >
          <PostEditorSidebar
            width={sidebarWidth}
            overlay={isNarrow}
            activeTab={sidebarTab}
            frontmatter={frontmatter}
            frontmatterRef={frontmatterRef}
            headings={headings}
            previewContent={previewContent}
            onTabChange={handleTabChange}
            onFrontmatterChange={handleFrontmatterChange}
            onCategoriesChange={handleCategoriesChange}
            onTOCNavigate={handleTOCNavigate}
          />
        </div>
      </div>

      {/* Category Mapping Dialog */}
      <CategoryMappingDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        newCategories={pendingCategoryMappings}
        onConfirm={handleCategoryMappingConfirm}
        onCancel={() => setShowCategoryDialog(false)}
      />
    </div>
  );
}
