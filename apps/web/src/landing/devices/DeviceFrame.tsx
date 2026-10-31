import type { ReactNode } from 'react';
import { cx } from '../components/cx';
import { useInView } from '../hooks/useInView';
import '../styles/devices.css';

export type DeviceKind = 'laptop' | 'tablet' | 'phone';

export interface DeviceProps {
  className?: string;
  /** Plays the one-shot entrance (tickets arrive, bars grow, PAID stamps) once the device is on screen. */
  animate?: boolean;
  /** Hide from assistive tech (use when a parent already describes the scene). Default false: role="img" + label. */
  decorative?: boolean;
  /** Override the default accessible description. */
  label?: string;
}

export interface DeviceFrameProps extends DeviceProps {
  kind: DeviceKind;
  /** Accessible description of what the mockup shows (the text inside is presentational). */
  label: string;
  /** Render prop receives `live` (animate requested AND the device is on screen). */
  children: ReactNode | ((live: boolean) => ReactNode);
}

/**
 * Crisp 1px bezel around an HTML/CSS screen. Scales like a picture: the frame is a CSS container and the screen's
 * font-size is set in cqw, so the parent only decides the WIDTH. Not interactive; exposed as one labelled image.
 */
export function DeviceFrame({ kind, label, className, animate = false, decorative = false, children }: DeviceFrameProps) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3, rootMargin: '0px 0px -5% 0px' });
  const live = animate && inView;
  return (
    <div
      ref={ref}
      className={cx('lp-dev', `lp-dev--${kind}`, className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      data-animate={animate ? '' : undefined}
      data-live={live ? 'true' : undefined}
    >
      <div className="lp-dev__bezel">
        <div className="lp-dev__screen">{typeof children === 'function' ? children(live) : children}</div>
      </div>
    </div>
  );
}

/** "Live" pill with a pulsing dot (the app's realtime badge). */
export function LiveBadge() {
  return (
    <span className="lp-dev__live">
      <span className="lp-dev__dot" />
      Live
    </span>
  );
}
