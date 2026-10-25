import { usePrefersReducedMotion } from '@hooks/useMediaQuery';
import { LazyMotion, MotionConfig } from 'motion/react';
import type { PropsWithChildren } from 'react';

const loadMotionFeatures = () => import('./motionFeatures').then(({ default: features }) => features);

export function LazyMotionProvider({ children }: PropsWithChildren) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
      <LazyMotion features={loadMotionFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
