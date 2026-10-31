import type { LucideIcon, LucideProps } from 'lucide-react';

export interface IconProps extends Omit<LucideProps, 'ref'> {
  /** A lucide-react icon component, e.g. `import { Utensils } from 'lucide-react'`. */
  icon: LucideIcon;
  /** Provide to expose the icon to assistive tech; otherwise it is hidden. */
  title?: string;
}

/** Thin wrapper: consistent stroke width, decorative by default. Import icons individually (tree-shaken). */
export function Icon({ icon: Glyph, size = 20, strokeWidth = 1.75, title, ...rest }: IconProps) {
  return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden={title ? undefined : true} aria-label={title} role={title ? 'img' : undefined} focusable="false" {...rest} />;
}

/** An icon sitting in the brand's green rounded tile (cards: icon tile #1DBA3C, glyph Ink). */
export function IconTile({ icon, size = 22, title }: { icon: LucideIcon; size?: number; title?: string }) {
  return (
    <span className="lp-icon-tile">
      <Icon icon={icon} size={size} title={title} />
    </span>
  );
}
