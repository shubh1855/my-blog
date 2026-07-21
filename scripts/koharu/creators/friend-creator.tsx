import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmScreen, CreatingScreen, DoneScreen, ErrorScreen, CycleSelect as Select, StepItem } from '../components';
import { useStepFlow } from '../hooks';
import { appendFriend, isValidUrl } from '../utils/new-operations';
import type { CreatorProps, FriendData } from './types';

type Step = 'site' | 'url' | 'owner' | 'desc' | 'image' | 'color' | 'color-custom' | 'confirm' | 'creating' | 'done' | 'error';

const INPUT_STEPS: Step[] = ['site', 'url', 'owner', 'desc', 'image', 'color'];

interface StepConfig {
  id: Step;
  label: string;
}

const STEP_CONFIGS: StepConfig[] = [
  { id: 'site', label: 'Site name' },
  { id: 'url', label: 'Site URL' },
  { id: 'owner', label: 'Owner nickname' },
  { id: 'desc', label: 'Site description' },
  { id: 'image', label: 'Avatar URL' },
  { id: 'color', label: 'Theme color' },
];

const PRESET_COLORS = [
  { label: 'Pink (#ffc0cb)', value: '#ffc0cb' },
  { label: 'Blue (#BEDCFF)', value: '#BEDCFF' },
  { label: 'Green (#98D8AA)', value: '#98D8AA' },
  { label: 'Custom color', value: 'custom' },
  { label: 'No color', value: '' },
];

export function FriendCreator({ onComplete, showReturnHint = false }: CreatorProps) {
  // Data state
  const [site, setSite] = useState('');
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState('');
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState('');
  const [color, setColor] = useState('');
  const [inputError, setInputError] = useState('');
  const [operationError, setOperationError] = useState('');

  // Step flow management
  const { step, setStep, getStepStatus, goBack } = useStepFlow({
    initialStep: 'site' as Step,
    inputSteps: INPUT_STEPS,
    onComplete,
    showReturnHint,
    normalizeStep: (s) => (s === 'color-custom' ? 'color' : s) as Step,
  });

  // Get display value for a completed step
  const getStepDisplayValue = useCallback(
    (stepId: Step): string => {
      switch (stepId) {
        case 'site':
          return site;
        case 'url':
          return url;
        case 'owner':
          return owner;
        case 'desc':
          return desc;
        case 'image':
          return image;
        case 'color':
          return color || '(none)';
        default:
          return '';
      }
    },
    [site, url, owner, desc, image, color],
  );

  useEffect(() => {
    if (step) {
      setInputError((prev) => (prev ? '' : prev));
    }
  }, [step]);

  const handleSiteSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setInputError('Site name is required');
        return;
      }
      setSite(value.trim());
      setInputError('');
      setStep('url');
    },
    [setStep],
  );

  const handleUrlSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setInputError('Site URL  is required');
        return;
      }
      if (!isValidUrl(value.trim())) {
        setInputError('Enter a valid URL');
        return;
      }
      setUrl(value.trim());
      setInputError('');
      setStep('owner');
    },
    [setStep],
  );

  const handleOwnerSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setInputError('Owner nickname is required');
        return;
      }
      setOwner(value.trim());
      setInputError('');
      setStep('desc');
    },
    [setStep],
  );

  const handleDescSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setInputError('Site description is required');
        return;
      }
      setDesc(value.trim());
      setInputError('');
      setStep('image');
    },
    [setStep],
  );

  const handleImageSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setInputError('Avatar URL  is required');
        return;
      }
      if (!isValidUrl(value.trim())) {
        setInputError('Enter a valid avatar URL');
        return;
      }
      setImage(value.trim());
      setInputError('');
      setStep('color');
    },
    [setStep],
  );

  const handleColorSelect = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setStep('color-custom');
        return;
      }
      setColor(value);
      setStep('confirm');
    },
    [setStep],
  );

  const handleCustomColorSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && !/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
        setInputError('Enter a valid hex color (e.g. #FF5733)');
        return;
      }
      setColor(trimmed);
      setInputError('');
      setStep('confirm');
    },
    [setStep],
  );

  const handleConfirm = useCallback(async () => {
    setStep('creating');
    try {
      const friendData: FriendData = {
        site,
        url,
        owner,
        desc,
        image,
        ...(color ? { color } : {}),
      };
      await appendFriend(friendData);
      setStep('done');
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, [site, url, owner, desc, image, color, setStep]);

  const handleCancel = useCallback(() => {
    goBack('confirm');
  }, [goBack]);

  const renderCurrentInput = () => {
    switch (step) {
      case 'site':
        return (
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput defaultValue={site} onSubmit={handleSiteSubmit} />
          </Box>
        );
      case 'url':
        return (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text dimColor>{'> '}</Text>
              <TextInput defaultValue={url || 'https://'} onSubmit={handleUrlSubmit} />
            </Box>
            <Text dimColor> Enter domain directly, or delete and paste full URL</Text>
          </Box>
        );
      case 'owner':
        return (
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput defaultValue={owner} onSubmit={handleOwnerSubmit} />
          </Box>
        );
      case 'desc':
        return (
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput defaultValue={desc} onSubmit={handleDescSubmit} />
          </Box>
        );
      case 'image':
        return (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text dimColor>{'> '}</Text>
              <TextInput defaultValue={image || 'https://'} onSubmit={handleImageSubmit} />
            </Box>
            <Text dimColor> Enter path directly, or delete and paste full URL</Text>
          </Box>
        );
      case 'color':
        return <Select options={PRESET_COLORS} onChange={handleColorSelect} />;
      case 'color-custom':
        return (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Text dimColor>{'> '}</Text>
              <TextInput defaultValue={color} onSubmit={handleCustomColorSubmit} />
            </Box>
            <Text dimColor> e.g. #FF5733</Text>
          </Box>
        );
      default:
        return null;
    }
  };

  if (step === 'confirm') {
    return (
      <ConfirmScreen
        title="Create new friend link"
        steps={STEP_CONFIGS.map((c) => ({
          label: c.label,
          value: getStepDisplayValue(c.id),
        }))}
        confirmText="Confirm add?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }

  if (step === 'creating') {
    return <CreatingScreen title="Create new friend link" message="Adding friend link..." />;
  }

  if (step === 'done') {
    return (
      <DoneScreen
        title="Create new friend link"
        message="Friend link added successfully!"
        detail="Added to config/site.yaml"
        showReturnHint={showReturnHint}
      />
    );
  }

  if (step === 'error') {
    return <ErrorScreen title="Create new friend link" error={operationError} showReturnHint={showReturnHint} />;
  }

  const normalizedStep = step === 'color-custom' ? 'color' : step;
  const showBackHint = INPUT_STEPS.includes(normalizedStep);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Create new friend link
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
