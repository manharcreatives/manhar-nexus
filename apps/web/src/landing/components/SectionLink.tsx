import type { AnchorHTMLAttributes } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isHomePath } from '../paths';

export interface SectionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Section id on the home page (without '#'); may include '?plan=floor' style params. */
  to: string;
}

/**
 * Link to a home-page section: a plain `#id` anchor when already on "/" (native smooth scroll), a router
 * `<Link to="/#id">` from policy/article pages (LandingApp scrolls to the hash after navigating).
 */
export function SectionLink({ to, children, ...rest }: SectionLinkProps) {
  const { pathname } = useLocation();
  if (isHomePath(pathname)) {
    return (
      <a href={`#${to}`} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={`/#${to}`} {...rest}>
      {children}
    </Link>
  );
}
