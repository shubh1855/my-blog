# Link Embedding Feature

![](https://r2.cosine.ren/i/2026/01/6804aa167fd4cf7022a9b511d52017ce.webp)

Automatically converts standalone Twitter/X and CodePen links into embed components, and displays OG preview cards for other links.

## Features

### 1. Automatic Tweet Embedding

Automatically converts standalone Twitter or X links into beautiful Tweet embed components:

- ✅ Supports `twitter.com` and `x.com` domains
- ✅ Only 16KB in size (vs Twitter native iframe 560KB)
- ✅ Automatically adapts to dark/light themes
- ✅ Server-side rendered, requiring no client-side JavaScript loading
- ✅ No iframe, avoiding layout shift

**Example:**

```markdown
This is a standalone Tweet link that will automatically convert to an embed component:

https://twitter.com/vercel/status/1683949196632969217

Or using the x.com domain:

https://x.com/elonmusk/status/1683631781486342144
```

### 2. Automatic CodePen Embedding

Automatically converts standalone CodePen links into interactive code demos:

- ✅ Supports `codepen.io` domain
- ✅ Uses CodePen official embed format
- ✅ Supports real-time code editing and preview
- ✅ Automatically adapts to Astro page navigation
- ✅ On-demand loading for optimized performance
- ✅ Supports dark/light themes

**Example:**

```markdown
This is a standalone CodePen link that will automatically convert to an interactive embed:

https://codepen.io/username/pen/PenId

Supported formats:
https://codepen.io/username/pen/PenId
https://codepen.io/username/details/PenId
```

**Technical Implementation:**

- Uses official CodePen Embed API (`__CPEmbed`)
- Automatically handles Astro page transitions to ensure embeds initialize correctly
- Scripts are loaded on-demand, only when the page contains CodePen embeds
- Supports multiple CodePen embeds on the same page

### 3. Generic Link Preview

Displays OG (Open Graph) preview cards for standalone standard links:

- ✅ Fetches OG metadata (title, description, image) at build time
- ✅ Fully static with zero runtime overhead
- ✅ Displays site favicon and domain
- ✅ Responsive design, mobile-friendly
- ✅ Graceful error handling and fallback
- ✅ Supports dark/light themes
- ✅ SEO friendly

**Example:**

```markdown
This is a standalone link that will display an OG preview:

https://github.com/vercel/react-tweet

Another example:

https://react-tweet.vercel.app/
```

### 4. Inline Links Remain Unchanged

Links inside paragraphs will not be converted, maintaining their original style:

```markdown
The link [react-tweet](https://github.com/vercel/react-tweet) inside this paragraph will not be embedded.
```

## How It Works

### Markdown Processing Workflow

1. **Remark Plugin Parsing**: `remark-link-embed` plugin identifies standalone links during Markdown compilation
2. **Link Classification**:
   - Detects Twitter/X links and extracts Tweet ID (client hydration)
   - Other links use **metascraper** to fetch OG data at build time (server rendering)
3. **Build-Time Processing**:
   - Tweet: Generates placeholders, client hydrates
   - Link Preview: Uses metascraper to fetch metadata, generating full static HTML
4. **Client Hydration**: `EmbedHydrator` component handles Tweet embeds only

### Architecture Diagram

```plain
Markdown File
    ↓
remark-link-embed plugin (Identify standalone links)
    ↓
├─ Tweet Link → Generate placeholder (<div data-tweet-embed>)
│                    ↓
│               EmbedHydrator (Client-hydrate TweetEmbed)
│
└─ Standard Link → metascraper fetches OG data at build time
                   ↓
              Generate full static HTML
```

## Configuration Options

Can be configured in `src/constants/content-config.ts`:

```typescript
export interface ContentConfig {
  // ... Other configurations

  // Whether to enable link embedding feature
  enableLinkEmbed: boolean;

  // Whether to enable Tweet embedding
  enableTweetEmbed: boolean;

  // Whether to enable OG link preview
  enableOGPreview: boolean;

  // Preview data cache time (seconds)
  previewCacheTime: number;

  // Whether to lazy load embedded content
  lazyLoadEmbeds: boolean;
}

export const defaultContentConfig: ContentConfig = {
  // ... Other configurations
  enableLinkEmbed: true,
  enableTweetEmbed: true,
  enableOGPreview: true,
  enableCodePenEmbed: true,
  previewCacheTime: 30, // 30 days
  lazyLoadEmbeds: true,
};
```

## File Structure

```plain
src/
├── lib/
│   └── markdown/
│       ├── remark-link-embed.ts      # Remark plugin (using metascraper)
│       └── link-utils.ts             # Link detection utilities
├── components/
│   └── embed/
│       ├── TweetEmbed.tsx            # Tweet embed component
│       └── EmbedHydrator.tsx         # Hydration component (handles tweets only)
└── styles/
    └── components/
        └── embed.css                 # Embed component styles
```

## Build-Time Data Fetching (metascraper)

Link preview uses **metascraper** to fetch OG metadata at build time without needing API endpoints:

- **Powerful Metadata Extraction**: metascraper supports multiple metadata sources and rules
- **Build-Time Processing**: OG data is fetched during Markdown compilation
- **Fully Static**: Zero runtime overhead
- **Graceful Fallback**: If fetching fails, degrades gracefully to a simple link
- **Automatic Updates**: Link content updates require rebuilding the site

### metascraper Features

- Supports standard Open Graph tags like og:title, og:description, og:image, etc.
- Automatically extracts website logo/favicon
- Smart fallback to meta tags and HTML title
- Highly customizable rule system

## Performance Optimization

### Tweet Embeds

- Uses `react-tweet` library, only 16KB vs native Twitter embeds at 560KB
- Server-side rendered, displayed on first screen load
- No iframe, avoiding extra HTTP requests and layout shifts

### Link Previews

- **Fully Static**: Fetches OG data at build time, zero runtime overhead
- **No JavaScript**: Does not require client-side JavaScript
- **SEO Friendly**: Search engines can directly index preview content
- **Graceful Fallback**: Displays simple link when fetching fails
- **Faster Page Load**: No extra API requests required

## Theme Support

Both embeds support dark/light themes:

- **TweetEmbed**: Listens for class changes on `document.documentElement` via MutationObserver
- **Link Preview**: Uses Tailwind theme variables for automatic adaptation without JavaScript

## Troubleshooting

### Tweet Not Displaying

1. Check if the Tweet ID is correct
2. Confirm network connection is working
3. Check if the Tweet has been deleted or set to private

### Link Preview Not Displaying

1. Check if the target website has OG tags
2. Check build logs to confirm whether OG data fetching succeeded
3. If the website requires authentication or has access restrictions, previews may fail to fetch
4. Check network connection to ensure access to the target website during build

### Style Issues

1. Ensure `src/styles/components/embed.css` is imported
2. Check if react-tweet styles are loaded correctly
3. Clear browser cache and retry

## Disabling Features

To disable this feature, configure in `src/constants/content-config.ts`:

```typescript
export const defaultContentConfig: ContentConfig = {
  // ...
  enableLinkEmbed: false,
  // Or disable specific features individually
  enableTweetEmbed: false,
  enableOGPreview: false,
};
```

## Tech Stack

- **react-tweet**: Tweet embedding library
- **metascraper**: Powerful metadata extraction library for fetching OG data at build time
- **remark**: Markdown processing
- **unist-util-visit**: AST traversal
- **React 19**: Tweet component rendering
- **Astro 5**: Framework integration
- **Static Site Generation (SSG)**: Link previews generated at build time
