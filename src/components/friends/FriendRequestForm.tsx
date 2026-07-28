import { siteConfig } from '@constants/site-config';
import { useClipboard } from 'foxact/use-clipboard';
import { useCallback } from 'react';

export default function FriendRequestForm() {
  const { copied, copy } = useClipboard({ timeout: 2000 });

  const yamlConfig = `name: ${siteConfig.name || 'Your Name'}
site: ${siteConfig.title || 'Your Site Title'}
url: ${siteConfig.site || 'https://yoursite.com'}
description: ${siteConfig.description || 'Your site description'}
avatar: ${siteConfig.site}${siteConfig.avatar?.startsWith('/') ? '' : '/'}${siteConfig.avatar || '/avatar.png'}
color: #ffc0cb`;

  const handleCopy = useCallback(() => {
    copy(yamlConfig);
  }, [copy, yamlConfig]);

  return (
    <div className="mb-4 w-full">
      <div className="relative overflow-hidden rounded-3xl border-2 border-gray-100 bg-white p-8 shadow-sm md:p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6">
          <h2 className="flex items-center gap-3 font-bold text-2xl text-gray-800 dark:text-white">🤝 Want to be friends</h2>
        </div>

        <div className="relative mb-8 overflow-hidden rounded-2xl border-2 border-gray-100 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-950/50">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-4 right-4 rounded-lg bg-gray-200/50 px-4 py-2 font-bold text-gray-600 text-sm transition-colors hover:bg-gray-300/50 hover:text-gray-900 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre className="whitespace-pre-wrap font-mono text-gray-600 text-sm leading-relaxed dark:text-gray-300">
            {yamlConfig}
          </pre>
        </div>
      </div>
    </div>
  );
}
