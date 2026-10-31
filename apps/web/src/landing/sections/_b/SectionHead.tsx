import type { ReactNode } from 'react';
import { SectionHead as Head } from '../../components/SectionHead';

export interface SectionHeadProps {
  eyebrow: ReactNode;
  title: ReactNode;
  titleId: string;
  lede?: ReactNode;
}

/** Thin alias of the shared SectionHead (kept so older imports keep working). */
export function SectionHead(props: SectionHeadProps) {
  return <Head {...props} />;
}
