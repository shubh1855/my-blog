/**
 * Frontmatter Editor
 *
 * Sidebar panel for editing post frontmatter fields.
 * Uses react-hook-form with Zod validation.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@iconify/react';
import { format, isValid, parse, parseISO } from 'date-fns';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { type FrontmatterFormData, frontmatterSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import type { BlogSchema } from '@/types';

export interface FrontmatterEditorRef {
  getFormData: () => FrontmatterFormData;
  isDirty: () => boolean;
  validate: () => Promise<boolean>;
}

interface FrontmatterEditorProps {
  frontmatter: BlogSchema;
  onChange: (frontmatter: BlogSchema) => void;
  onCategoriesChange?: (categories: string[]) => void;
}

/**
 * Formats a Date to YYYY-MM-DD HH:mm:ss string
 */
function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (!isValid(d)) return '';
  return format(d, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Parses a date string to Date object
 */
function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  // Try parsing with format pattern
  const parsed = parse(dateStr, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (isValid(parsed)) return parsed;
  // Try ISO format
  const iso = new Date(dateStr);
  if (isValid(iso)) return iso;
  return undefined;
}

/**
 * Formats categories array to string
 */
function categoriesToString(categories?: string | string[] | string[][]): string {
  if (!categories) return '';
  if (typeof categories === 'string') return categories;

  // Handle nested array like [['笔记', '前端']]
  const flat = categories.flatMap((c) => (Array.isArray(c) ? c : [c]));
  return flat.join(' > ');
}

/**
 * Parses categories string to array
 */
function stringToCategories(str: string): string[] | undefined {
  if (!str.trim()) return undefined;
  return str
    .split('>')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Formats tags array to string
 */
function tagsToString(tags?: string[]): string {
  if (!tags || tags.length === 0) return '';
  return tags.join(', ');
}

/**
 * Parses tags string to array
 */
function stringToTags(str: string): string[] | undefined {
  if (!str.trim()) return undefined;
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Converts form data back to BlogSchema format
 */
function formDataToFrontmatter(data: FrontmatterFormData, original: BlogSchema, dirty: Record<string, boolean>): BlogSchema {
  const result: BlogSchema = { ...original };
  const set = (formKey: keyof FrontmatterFormData, key: keyof BlogSchema, value: unknown) => {
    if (!dirty[formKey]) return;
    if (value === undefined || value === '') delete result[key];
    else (result as unknown as Record<string, unknown>)[key] = value;
  };

  set('title', 'title', data.title);
  set('draft', 'draft', data.draft);
  set('sticky', 'sticky', data.sticky);
  set('tocNumbering', 'tocNumbering', data.tocNumbering);
  set('excludeFromSummary', 'excludeFromSummary', data.excludeFromSummary);
  set('math', 'math', data.math);
  set('quiz', 'quiz', data.quiz);

  // Parse dates
  if (dirty.date) set('date', 'date', data.date ? parseDate(data.date) : undefined);
  if (dirty.updated) set('updated', 'updated', data.updated ? parseDate(data.updated) : undefined);

  // Parse categories
  const categories = stringToCategories(data.categories || '');
  if (dirty.categories && categories && categories.length > 0) {
    // Store as nested array for proper YAML format
    result.categories = [categories];
  } else if (dirty.categories) delete result.categories;

  // Parse tags
  const tags = stringToTags(data.tags || '');
  if (dirty.tags && tags) {
    result.tags = tags;
  } else if (dirty.tags) delete result.tags;

  // Optional string fields
  set('description', 'description', data.description?.trim());
  set('cover', 'cover', data.cover?.trim());
  set('link', 'link', data.link?.trim());
  set('subtitle', 'subtitle', data.subtitle?.trim());

  return result;
}

/**
 * Input field component
 */
function FormField({
  label,
  id,
  type = 'text',
  placeholder,
  error,
  className,
  ...props
}: {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  error?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="font-medium text-muted-foreground text-xs">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className={cn(
          'w-full rounded border border-input bg-background px-2 py-1.5 text-sm',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          error && 'border-destructive',
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Textarea field component
 */
function FormTextarea({
  label,
  id,
  placeholder,
  error,
  className,
  ...props
}: {
  label: string;
  id: string;
  placeholder?: string;
  error?: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="font-medium text-muted-foreground text-xs">
        {label}
      </label>
      <textarea
        id={id}
        placeholder={placeholder}
        className={cn(
          'w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-sm',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          error && 'border-destructive',
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Checkbox field component
 */
function FormCheckbox({
  label,
  id,
  description,
  ...props
}: {
  label: string;
  id: string;
  description?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" className="mt-0.5 size-4 rounded border-input" {...props} />
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm">
          {label}
        </label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
    </div>
  );
}

export const FrontmatterEditor = forwardRef<FrontmatterEditorRef, FrontmatterEditorProps>(function FrontmatterEditor(
  { frontmatter, onChange, onCategoriesChange },
  ref,
) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<FrontmatterFormData>({
    resolver: zodResolver(frontmatterSchema),
    defaultValues: {
      title: frontmatter.title || '',
      date: formatDate(frontmatter.date),
      updated: formatDate(frontmatter.updated),
      description: frontmatter.description || '',
      categories: categoriesToString(frontmatter.categories),
      tags: tagsToString(frontmatter.tags),
      cover: frontmatter.cover || '',
      link: frontmatter.link || '',
      subtitle: frontmatter.subtitle || '',
      draft: frontmatter.draft ?? true,
      sticky: frontmatter.sticky ?? false,
      tocNumbering: frontmatter.tocNumbering ?? true,
      excludeFromSummary: frontmatter.excludeFromSummary ?? false,
      math: frontmatter.math ?? false,
      quiz: frontmatter.quiz ?? false,
    },
  });

  const {
    register,
    watch,
    formState: { errors, isDirty },
  } = form;
  const changedFields = useRef<Record<string, boolean>>({});

  // Expose form methods via ref
  useImperativeHandle(ref, () => ({
    getFormData: () => form.getValues(),
    isDirty: () => isDirty,
    validate: async () => {
      const valid = await form.trigger();
      const values = form.getValues();
      let datesValid = true;
      for (const field of ['date', 'updated'] as const) {
        const value = values[field]?.trim();
        if (!value) continue;
        const parsed = parseDate(value);
        const isCanonical = parsed && formatDate(parsed) === value;
        const isIso = /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && isValid(parseISO(value));
        if (!isCanonical && !isIso) {
          form.setError(field, { type: 'validate', message: 'Use YYYY-MM-DD HH:mm:ss or a valid ISO date.' });
          datesValid = false;
        }
      }
      return valid && datesValid;
    },
  }));

  // Watch for changes and notify parent
  useEffect(() => {
    const subscription = watch((values, metadata) => {
      if (metadata.name) changedFields.current[metadata.name] = true;
      const fm = formDataToFrontmatter(values as FrontmatterFormData, frontmatter, changedFields.current);
      onChange(fm);

      // Notify about categories change for new category detection
      if (onCategoriesChange) {
        const cats = stringToCategories(values.categories || '');
        onCategoriesChange(cats || []);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange, onCategoriesChange, frontmatter]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm">Frontmatter</h3>

      {/* Basic Fields */}
      <div className="space-y-3">
        <FormField label="Title" id="title" placeholder="Post title" error={errors.title?.message} {...register('title')} />

        <div className="grid grid-cols-2 gap-2">
          <FormField
            label="Date"
            id="date"
            placeholder="YYYY-MM-DD HH:mm:ss"
            error={errors.date?.message}
            {...register('date')}
          />
          <FormField
            label="Updated"
            id="updated"
            placeholder="YYYY-MM-DD HH:mm:ss"
            error={errors.updated?.message}
            {...register('updated')}
          />
        </div>

        <FormTextarea
          label="Description"
          id="description"
          placeholder="Post description..."
          rows={2}
          error={errors.description?.message}
          {...register('description')}
        />

        <FormField
          label="Categories"
          id="categories"
          placeholder="Notes > Frontend > React"
          error={errors.categories?.message}
          {...register('categories')}
        />

        <FormField label="Tags" id="tags" placeholder="tag1, tag2, tag3" error={errors.tags?.message} {...register('tags')} />

        <FormField
          label="Cover Image"
          id="cover"
          placeholder="https://example.com/image.jpg"
          error={errors.cover?.message}
          {...register('cover')}
        />

        <FormField
          label="Post Permalink"
          id="link"
          placeholder="writeups/event/post"
          error={errors.link?.message}
          {...register('link')}
        />
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
      >
        <span className="font-medium">Advanced Options</span>
        <Icon icon={showAdvanced ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'} className="size-5 text-muted-foreground" />
      </button>

      {/* Advanced Fields */}
      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <FormField
            label="Subtitle"
            id="subtitle"
            placeholder="Post subtitle"
            error={errors.subtitle?.message}
            {...register('subtitle')}
          />

          <div className="space-y-2">
            <FormCheckbox label="Draft" id="draft" description="Hide from published posts" {...register('draft')} />

            <FormCheckbox label="Sticky" id="sticky" description="Pin to top of post list" {...register('sticky')} />

            <FormCheckbox
              label="TOC Numbering"
              id="tocNumbering"
              description="Add numbers to headings"
              {...register('tocNumbering')}
            />

            <FormCheckbox
              label="Exclude from AI Summary"
              id="excludeFromSummary"
              description="Skip AI summary generation"
              {...register('excludeFromSummary')}
            />

            <FormCheckbox label="Math (KaTeX)" id="math" description="Enable math formula rendering" {...register('math')} />

            <FormCheckbox label="Quiz Mode" id="quiz" description="Enable quiz interaction" {...register('quiz')} />
          </div>
        </div>
      )}
    </div>
  );
});
