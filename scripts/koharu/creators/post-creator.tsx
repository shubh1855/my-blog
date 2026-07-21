import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmScreen, CreatingScreen, DoneScreen, ErrorScreen, CycleSelect as Select, StepItem } from '../components';
import { useStepFlow } from '../hooks';
import { createPost, generateSlug, getCategoryTree, postExists } from '../utils/new-operations';
import type { CategoryTreeItem, CreatorProps, PostData } from './types';

type Step = 'title' | 'slug' | 'description' | 'category' | 'tags' | 'draft' | 'confirm' | 'creating' | 'done' | 'error';

const INPUT_STEPS: Step[] = ['title', 'slug', 'description', 'category', 'tags', 'draft'];

interface StepConfig {
  id: Step;
  label: string;
}

const STEP_CONFIGS: StepConfig[] = [
  { id: 'title', label: 'Title' },
  { id: 'slug', label: 'Slug' },
  { id: 'description', label: 'Description' },
  { id: 'category', label: 'Category' },
  { id: 'tags', label: 'Tags' },
  { id: 'draft', label: 'Draft' },
];

export function PostCreator({ onComplete, showReturnHint = false }: CreatorProps) {
  // Data state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryTreeItem | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState(false);
  const [inputError, setInputError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [createdPath, setCreatedPath] = useState('');
  const [categories, setCategories] = useState<CategoryTreeItem[]>([]);

  // Step flow management
  const { step, setStep, getStepStatus, goBack } = useStepFlow({
    initialStep: 'title' as Step,
    inputSteps: INPUT_STEPS,
    onComplete,
    showReturnHint,
  });

  // Load categories asynchronously
  useEffect(() => {
    getCategoryTree().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (step) {
      setInputError((prev) => (prev ? '' : prev));
    }
  }, [step]);

  // Get display value for a completed step
  const getStepDisplayValue = useCallback(
    (stepId: Step): string => {
      switch (stepId) {
        case 'title':
          return title;
        case 'slug':
          return slug || '(none)';
        case 'description':
          return description || '(none)';
        case 'category':
          return category?.path.join(' → ') || '';
        case 'tags':
          return tags.length > 0 ? tags.join(', ') : '(none)';
        case 'draft':
          return draft ? 'Yes' : 'No';
        default:
          return '';
      }
    },
    [title, slug, description, category, tags, draft],
  );

  const handleTitleSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setInputError('Title is required');
        return;
      }
      const trimmedTitle = value.trim();
      setTitle(trimmedTitle);
      setAutoSlug(generateSlug(trimmedTitle));
      setInputError('');
      setStep('slug');
    },
    [setStep],
  );

  const handleSlugSubmit = useCallback(
    (value: string) => {
      const finalSlug = value.trim();
      setSlug(finalSlug);
      setInputError('');
      setStep('description');
    },
    [setStep],
  );

  const handleDescriptionSubmit = useCallback(
    (value: string) => {
      setDescription(value.trim());
      setInputError('');
      setStep('category');
    },
    [setStep],
  );

  const handleCategorySelect = useCallback(
    (value: string) => {
      const selected = categories.find((c) => c.slug === value);
      if (selected) {
        setCategory(selected);
        setInputError('');
        setStep('tags');
      }
    },
    [categories, setStep],
  );

  const handleTagsSubmit = useCallback(
    (value: string) => {
      const tagList = value
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);
      setTags(tagList);
      setInputError('');
      setStep('draft');
    },
    [setStep],
  );

  const handleDraftSelect = useCallback(
    (value: string) => {
      setDraft(value === 'yes');
      setStep('confirm');
    },
    [setStep],
  );

  const handleConfirm = useCallback(async () => {
    if (!category) {
      setOperationError('No category selected');
      setStep('error');
      return;
    }

    const linkValue = slug || undefined;
    if (await postExists(linkValue, title, category.path)) {
      const filename = slug || generateSlug(title);
      setOperationError(`Post already exists: ${filename}.md`);
      setStep('error');
      return;
    }

    setStep('creating');

    try {
      const postData: PostData = {
        title,
        link: slug || undefined,
        description: description || undefined,
        categories: category.path,
        tags,
        draft,
      };

      const filePath = await createPost(postData);
      setCreatedPath(filePath);
      setStep('done');
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, [category, slug, title, description, tags, draft, setStep]);

  const handleCancel = useCallback(() => {
    goBack('confirm');
  }, [goBack]);

  const categoryOptions = categories.map((c) => ({
    label: c.level > 0 ? `  └ ${c.name}` : c.name,
    value: c.slug,
  }));

  const renderCurrentInput = () => {
    switch (step) {
      case 'title':
        return (
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput defaultValue={title} onSubmit={handleTitleSubmit} />
          </Box>
        );
      case 'slug':
        return (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text dimColor>{'> '}</Text>
              <TextInput defaultValue={slug || autoSlug} onSubmit={handleSlugSubmit} />
            </Box>
            <Text dimColor> Press Enter to use it; clear then Enter to omit link field</Text>
          </Box>
        );
      case 'description':
        return (
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput defaultValue={description} onSubmit={handleDescriptionSubmit} />
          </Box>
        );
      case 'category':
        return <Select options={categoryOptions} onChange={handleCategorySelect} />;
      case 'tags':
        return (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text dimColor>{'> '}</Text>
              <TextInput defaultValue={tags.join(', ')} onSubmit={handleTagsSubmit} />
            </Box>
            <Text dimColor> Separate tags with commas, e.g. tag1, tag2</Text>
          </Box>
        );
      case 'draft':
        return (
          <Select
            options={[
              { label: 'No - publish now', value: 'no' },
              { label: 'Yes - save as draft', value: 'yes' },
            ]}
            onChange={handleDraftSelect}
          />
        );
      default:
        return null;
    }
  };

  if (step === 'confirm') {
    return (
      <ConfirmScreen
        title="Create new blog post"
        steps={STEP_CONFIGS.map((c) => ({
          label: c.label,
          value: getStepDisplayValue(c.id),
        }))}
        confirmText="Confirm create?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }

  if (step === 'creating') {
    return <CreatingScreen title="Create new blog post" message="Creating post..." />;
  }

  if (step === 'done') {
    return (
      <DoneScreen
        title="Create new blog post"
        message="Post created successfully!"
        detail={`Path: ${createdPath}`}
        showReturnHint={showReturnHint}
      />
    );
  }

  if (step === 'error') {
    return <ErrorScreen title="Create new blog post" error={operationError} showReturnHint={showReturnHint} />;
  }

  const showBackHint = INPUT_STEPS.includes(step);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Create new blog post
        </Text>
      </Box>

      {STEP_CONFIGS.map((config) => (
        <StepItem
          key={config.id}
          label={config.label}
          status={getStepStatus(config.id)}
          completedValue={getStepDisplayValue(config.id)}
          error={getStepStatus(config.id) === 'active' ? inputError : undefined}
        >
          {getStepStatus(config.id) === 'active' && renderCurrentInput()}
        </StepItem>
      ))}

      {showBackHint && (
        <Box marginTop={1}>
          <Text dimColor>Press Esc to go back; on first step, Esc exits</Text>
        </Box>
      )}
    </Box>
  );
}
