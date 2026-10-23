/**
 * ProgressCircle Component
 *
 * SVG circular progress indicator showing overall article scroll progress.
 * Uses Motion's useScroll for tracking and useSpring for smooth animation.
 */

import { useTranslation } from '@hooks/useTranslation';
import { useStore } from '@nanostores/react';
import { masterMotionEnabled, scrollProgressEnabled } from '@store/settings';
import { m, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';

interface ProgressCircleProps {
  /** Circle size in pixels (default: 28) */
  size?: number;
  /** Stroke width in pixels (default: 2) */
  strokeWidth?: number;
  /** Additional CSS classes */
  className?: string;
}

export function ProgressCircle({ size = 28, strokeWidth = 2, className }: ProgressCircleProps) {
  const { t } = useTranslation();
  const [percentage, setPercentage] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const enabled = useStore(scrollProgressEnabled);
  const masterMotion = useStore(masterMotionEnabled);
  const { scrollYProgress } = useScroll();
  useEffect(() => {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    setPercentage(distance > 0 ? Math.max(0, Math.min(100, Math.round((window.scrollY / distance) * 100))) : 0);
  }, []);
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    setPercentage(Math.max(0, Math.min(100, Math.round(value * 100))));
  });

  const springProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const progress = shouldReduceMotion || masterMotion ? scrollYProgress : springProgress;

  if (!enabled) return null;

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-label={t('post.readingProgress')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Background circle (track) */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-20"
      />
      {/* Progress circle */}
      <m.circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="text-primary"
        style={{
          pathLength: progress,
        }}
      />
    </svg>
  );
}
