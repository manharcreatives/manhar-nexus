import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SectionLink } from './SectionLink';
import { cx } from './cx';

interface ButtonBase {
  /** primary = Manhar Green fill + Ink text · secondary = 1px outline · ghost = text-only with underline-draw */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Which surface the button sits on. 'dark' flips secondary/ghost to white-on-Ink. Inside .lp-on-dark it is automatic. */
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  /** Append an arrow that nudges on hover. */
  arrow?: boolean;
  /** Full width. */
  block?: boolean;
  className?: string;
  children: ReactNode;
}

type AnchorExtras = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>;

export type ButtonProps =
  | (ButtonBase & AnchorExtras & { href: string; to?: undefined; external?: boolean })
  | (ButtonBase & AnchorExtras & { to: string; href?: undefined; external?: undefined })
  | (ButtonBase & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined; to?: undefined; external?: undefined });

/**
 * Renders <a href> (plain anchor: hash links, mailto, tel, external), a router <Link to> (internal routes such
 * as "/login"), or a <button>. Needs to be inside a Router when `to` is used.
 *   <Button href="#register" arrow>Register your restaurant</Button>
 *   <Button to="/login" variant="secondary">Sign in</Button>
 *   <Button variant="secondary" tone="dark" onClick={...}>Book a live demo</Button>
 */
export function Button(props: ButtonProps) {
  const { variant = 'primary', tone = 'light', size = 'md', arrow = false, block = false, className, children } = props;
  const cls = cx('lp-btn', `lp-btn--${variant}`, `lp-btn--${size}`, tone === 'dark' && 'lp-btn--dark', block && 'lp-btn--block', className);
  const label = (
    <>
      <span className="lp-btn__label">{children}</span>
      {arrow ? (
        <svg className="lp-btn__arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </>
  );

  if (props.to !== undefined) {
    const { to, variant: _v, tone: _t, size: _s, arrow: _a, block: _b, className: _c, children: _ch, href: _h, external: _e, ...rest } = props;
    return (
      <Link to={to} className={cls} {...rest}>
        {label}
      </Link>
    );
  }
  if (props.href !== undefined) {
    const { href, external, variant: _v, tone: _t, size: _s, arrow: _a, block: _b, className: _c, children: _ch, to: _to, ...rest } = props;
    const ext = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
    return (
      <a href={href} className={cls} {...ext} {...rest}>
        {label}
      </a>
    );
  }
  const { variant: _v, tone: _t, size: _s, arrow: _a, block: _b, className: _c, children: _ch, href: _h, to: _to, external: _e, type = 'button', ...rest } = props;
  return (
    <button type={type} className={cls} {...rest}>
      {label}
    </button>
  );
}

export interface SectionButtonProps extends ButtonBase {
  /** Home-page section id (e.g. 'register'); works from the home page AND from policy/article pages. */
  section: string;
  onClick?: () => void;
}

/** Button-styled link to a home-page section (use instead of <Button href="#id"> in site chrome shared with policy pages). */
export function SectionButton({ section, variant = 'primary', tone = 'light', size = 'md', arrow = false, block = false, className, children, onClick }: SectionButtonProps) {
  const cls = cx('lp-btn', `lp-btn--${variant}`, `lp-btn--${size}`, tone === 'dark' && 'lp-btn--dark', block && 'lp-btn--block', className);
  return (
    <SectionLink to={section} className={cls} onClick={onClick}>
      <span className="lp-btn__label">{children}</span>
      {arrow ? (
        <svg className="lp-btn__arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </SectionLink>
  );
}
