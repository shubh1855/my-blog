import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@iconify/react';
import { decryptContent } from '@lib/crypto/decrypt';
import { cn } from '@lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

interface EncryptedBlockProps {
  element: HTMLElement;
}

type DecryptState = 'locked' | 'decrypting' | 'unlocked' | 'error';

export function EncryptedBlock({ element }: EncryptedBlockProps) {
  const [state, setState] = useState<DecryptState>('locked');
  const decryptedRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleDecrypt = useCallback(async () => {
    const password = inputRef.current?.value;
    if (!password || state === 'decrypting') return;

    const { cipher, iv, salt } = element.dataset;
    if (!cipher || !iv || !salt) return;

    setState('decrypting');
    const result = await decryptContent(cipher, iv, salt, password);

    if (result) {
      decryptedRef.current = result;
      setState('unlocked');
    } else {
      setState('error');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [element, state]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleDecrypt();
    },
    [handleDecrypt],
  );

  useEffect(() => {
    if (state !== 'unlocked') return;
    element.innerHTML = decryptedRef.current;
    element.classList.remove('encrypted-block');
    element.classList.add('encrypted-block-content');
    for (const key of ['cipher', 'iv', 'salt', 'react-enhanced']) element.removeAttribute(`data-${key}`);
    element.tabIndex = -1;
    element.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('content:decrypted'));
  }, [state, element]);

  if (!element.dataset.cipher || !element.dataset.iv || !element.dataset.salt) {
    return <div className="encrypted-block-error">Error: Missing encryption data</div>;
  }

  if (state === 'unlocked') return null;

  return (
    <div className="encrypted-block-locked">
      <Icon
        icon="ri:lock-2-fill"
        className={cn('encrypted-block-icon', state === 'error' && 'encrypted-block-icon-error')}
        aria-label={t('encrypted.locked')}
      />
      <div className="encrypted-block-input-group">
        <input
          ref={inputRef}
          type="password"
          className="encrypted-block-input"
          aria-label={t('encrypted.placeholder')}
          aria-invalid={state === 'error'}
          placeholder={t('encrypted.placeholder')}
          autoComplete="off"
          onKeyDown={handleKeyDown}
          disabled={state === 'decrypting'}
        />
        <button
          type="button"
          className={cn('encrypted-block-btn', state === 'error' && 'encrypted-shake')}
          onClick={handleDecrypt}
          disabled={state === 'decrypting'}
          aria-label={t('encrypted.submit')}
        >
          {state === 'decrypting' ? (
            <Icon icon="ri:loader-4-line" className="animate-spin" />
          ) : (
            <Icon icon="ri:lock-unlock-line" />
          )}
        </button>
      </div>
      {state === 'error' && <p role="alert">{t('encrypted.incorrect')}</p>}
    </div>
  );
}
