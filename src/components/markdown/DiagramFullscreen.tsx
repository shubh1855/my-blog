/**
 * Unified fullscreen viewer for mermaid and infographic diagrams.
 * Replaces MermaidFullscreen.astro (482 lines) + InfographicFullscreen.astro (489 lines).
 *
 * Uses shared useZoomPan hook for zoom/pan, shared MacToolbar for the toolbar,
 * and the unified $diagramFullscreenData store.
 */

import { CopyButton } from '@components/markdown/shared/CopyButton';
import { MacToolbar } from '@components/markdown/shared/MacToolbar';
import { ModalLayer } from '@components/ui/ModalLayer';
import { useTranslation } from '@hooks/useTranslation';
import { useZoomPan } from '@hooks/useZoomPan';
import { Icon } from '@iconify/react';
import { cn } from '@lib/utils';
import { useStore } from '@nanostores/react';
import { $diagramFullscreenData, closeModal, type DiagramFullscreenData } from '@store/modal';
import { useEffect } from 'react';

export default function DiagramFullscreen() {
  const data = useStore($diagramFullscreenData);
  const { t } = useTranslation();
  const isOpen = data !== null;
  const { containerRef, state, reset, zoomTo, panBy, zoomLevel } = useZoomPan(isOpen);

  // Reset zoom when opening
  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  if (!data) return null;

  return (
    <ModalLayer open onClose={closeModal} ariaLabel={`${data.diagramType} ${t('diagram.fullscreen')}`}>
      <DiagramToolbar
        data={data}
        zoomLevel={zoomLevel}
        onReset={reset}
        onZoomIn={() => zoomTo(state.scale * 1.1)}
        onZoomOut={() => zoomTo(state.scale / 1.1)}
        scale={state.scale}
      />
      <div
        ref={containerRef}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users focus the graphic to zoom and pan it with the documented controls.
        tabIndex={0}
        role="img"
        aria-label={`${data.diagramType} ${t('diagram.fullscreen')}`}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || (event.shiftKey && event.key !== '+')) return;
          switch (event.key) {
            case 'ArrowLeft':
              event.preventDefault();
              panBy(-48, 0);
              break;
            case 'ArrowRight':
              event.preventDefault();
              panBy(48, 0);
              break;
            case 'ArrowUp':
              event.preventDefault();
              panBy(0, -48);
              break;
            case 'ArrowDown':
              event.preventDefault();
              panBy(0, 48);
              break;
            case '+':
            case '=':
              event.preventDefault();
              zoomTo(state.scale * 1.1);
              break;
            case '-':
              event.preventDefault();
              zoomTo(state.scale / 1.1);
              break;
            case '0':
              event.preventDefault();
              reset();
              break;
          }
        }}
        className={cn(
          'flex flex-1 cursor-grab items-center justify-center overflow-hidden focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] active:cursor-grabbing',
          data.diagramType === 'infographic' && 'infographic-container',
        )}
      >
        <div
          className={cn(
            'flex origin-center items-center justify-center transition-transform duration-100',
            data.diagramType === 'mermaid' ? 'mermaid-svg-container' : 'infographic-svg-container',
          )}
          style={{
            transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
            width: '100%',
            height: '100%',
          }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG from mermaid/infographic render output
          dangerouslySetInnerHTML={{ __html: data.svg }}
        />
      </div>
    </ModalLayer>
  );
}

function DiagramToolbar({
  data,
  zoomLevel,
  onReset,
  onZoomIn,
  onZoomOut,
  scale,
}: {
  data: DiagramFullscreenData;
  zoomLevel: string;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  scale: number;
}) {
  const { t } = useTranslation();
  return (
    <MacToolbar language={data.diagramType} className="tablet:items-stretch tablet:px-2" onClose={closeModal}>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-2 tablet:ml-auto text-muted-foreground text-sm">{zoomLevel}</span>
        <button
          type="button"
          onClick={onZoomIn}
          disabled={scale >= 4.9}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          title={t('image.zoomIn')}
          aria-label={t('image.zoomIn')}
        >
          <Icon icon="ri:zoom-in-line" className="size-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          disabled={scale <= 0.55}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          title={t('image.zoomOut')}
          aria-label={t('image.zoomOut')}
        >
          <Icon icon="ri:zoom-out-line" className="size-4" />
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={t('diagram.resetZoom')}
        >
          <Icon icon="ri:refresh-line" className="size-4" />
          <span className="text-sm">{t('diagram.resetZoom')}</span>
        </button>
        <CopyButton text={data.source} showLabel />
      </div>
    </MacToolbar>
  );
}
