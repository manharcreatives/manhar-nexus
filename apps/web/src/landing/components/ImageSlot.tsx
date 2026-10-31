import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cx } from './cx';

export interface ImageSource {
  /** e.g. 'image/avif' */
  type: string;
  srcSet: string;
  sizes?: string;
}

export interface ImageSlotProps {
  /** Public path, e.g. '/landing/hero-pass.webp' */
  src: string;
  /** Required; pass '' (with `decorative`) for purely decorative images. */
  alt: string;
  /** Intrinsic pixel size: reserves the box (aspect-ratio) so nothing shifts. */
  width: number;
  height: number;
  srcSet?: string;
  sizes?: string;
  /** Extra <source> elements (avif/webp) for <picture>. */
  sources?: ImageSource[];
  /** Above-the-fold image: eager + fetchpriority=high. Default lazy. */
  priority?: boolean;
  /** Decorative: alt="" + aria-hidden. */
  decorative?: boolean;
  fit?: 'cover' | 'contain';
  /** object-position, e.g. '50% 30%' */
  position?: string;
  /** Surface of the fallback box shown when the file is missing: 'ink' | 'grey'. */
  fallback?: 'ink' | 'grey';
  /** Small mono label inside the fallback box (default: the file name). */
  fallbackLabel?: string;
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
}

/**
 * <picture>/<img> with width/height, lazy + async decoding, and a graceful fallback box when the file 404s
 * (images are generated later; builds and layouts must never depend on them). The wrapper keeps the
 * aspect-ratio either way. In dev/prod the SPA fallback may answer a missing file with index.html: the
 * <img> still fires `error` (not an image), so the fallback is shown.
 */
export function ImageSlot({
  src,
  alt,
  width,
  height,
  srcSet,
  sizes,
  sources,
  priority = false,
  decorative = false,
  fit = 'cover',
  position,
  fallback = 'ink',
  fallbackLabel,
  className,
  imgClassName,
  style,
}: ImageSlotProps) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc) setFailed(true);
  }, [src]);

  const label = fallbackLabel ?? src.split('/').pop() ?? 'image';
  const boxStyle: CSSProperties = { aspectRatio: `${width} / ${height}`, ...style };
  const hint = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {};

  return (
    <span className={cx('lp-img', `lp-img--${fallback}`, failed && 'is-failed', className)} style={boxStyle}>
      {failed ? (
        <span className="lp-img__fallback" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : alt} aria-hidden={decorative ? true : undefined}>
          <span className="lp-img__label">{label}</span>
        </span>
      ) : (
        <picture>
          {sources?.map((s) => (
            <source key={s.type + s.srcSet} type={s.type} srcSet={s.srcSet} sizes={s.sizes} />
          ))}
          <img
            ref={imgRef}
            className={cx('lp-img__el', fit === 'contain' && 'lp-img__el--contain', imgClassName)}
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            width={width}
            height={height}
            alt={decorative ? '' : alt}
            aria-hidden={decorative ? true : undefined}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            style={position ? { objectPosition: position } : undefined}
            onError={() => setFailed(true)}
            {...hint}
          />
        </picture>
      )}
    </span>
  );
}
