import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import {
  ASPECT,
  ZOOM_MAX,
  ZOOM_MIN,
  cropRect,
  exportCrop,
  formatBytes,
  isTooSmall,
  panCenter,
  type ImageKind,
  type Point,
  MAX_UPLOAD_BYTES,
} from './imageTools';

/**
 * Crop-to-aspect helper (4:5 for dishes). Drag or use the arrow keys to position, the slider
 * (or +/-) to zoom. Exports a re-encoded blob, so metadata never leaves the device.
 */
export function ImageCropDialog({
  file,
  kind,
  title,
  onConfirm,
  onCancel,
}: {
  file: File;
  kind: ImageKind;
  title: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const aspect = ASPECT[kind];
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<Point>({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drag = useRef<{ x: number; y: number } | null>(null);

  const rect = natural ? cropRect(natural, aspect, zoom, center) : null;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !natural || !rect || !frameRef.current) return;
    const delta = { x: e.clientX - drag.current.x, y: e.clientY - drag.current.y };
    drag.current = { x: e.clientX, y: e.clientY };
    setCenter((c) => panCenter(c, delta, frameRef.current?.clientWidth ?? 0, rect, natural));
  }
  function endDrag() {
    drag.current = null;
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!natural || !rect) return;
    const step = 24;
    const move = (dx: number, dy: number) => {
      e.preventDefault();
      setCenter((c) => panCenter(c, { x: dx, y: dy }, frameRef.current?.clientWidth ?? 300, rect, natural));
    };
    if (e.key === 'ArrowLeft') move(step, 0);
    else if (e.key === 'ArrowRight') move(-step, 0);
    else if (e.key === 'ArrowUp') move(0, step);
    else if (e.key === 'ArrowDown') move(0, -step);
    else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.2).toFixed(2)));
    else if (e.key === '-') setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.2).toFixed(2)));
  }

  async function confirm() {
    if (!rect || !imgRef.current) return;
    setBusy(true);
    setError('');
    try {
      const blob = await exportCrop(imgRef.current, rect, kind);
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError(t('qr.crop.tooBig', { size: formatBytes(blob.size) }));
        return;
      }
      onConfirm(blob);
    } catch {
      setError(t('qr.crop.failed'));
    } finally {
      setBusy(false);
    }
  }

  const small = natural ? isTooSmall(natural) : false;

  return (
    <Dialog
      open
      onClose={() => !busy && onCancel()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('qr.common.cancel')}
          </Button>
          <Button onClick={() => void confirm()} loading={busy} disabled={!rect || failed}>
            {t('qr.crop.use')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{t(`qr.crop.help.${kind}`)}</p>
        {failed ? (
          <p role="alert" className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">{t('qr.crop.unreadable')}</p>
        ) : (
          <div
            ref={frameRef}
            role="group"
            tabIndex={0}
            aria-label={t('qr.crop.frameLabel')}
            aria-describedby="qr-crop-keys"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className="relative mx-auto w-full max-w-[20rem] cursor-grab touch-none overflow-hidden rounded-control border border-white/15 bg-black active:cursor-grabbing"
            style={{ aspectRatio: String(aspect) }}
          >
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailed(true)}
              className="pointer-events-none absolute max-w-none select-none"
              style={
                rect && natural
                  ? {
                      width: `${(natural.w / rect.sw) * 100}%`,
                      left: `${(-rect.sx / rect.sw) * 100}%`,
                      top: `${(-rect.sy / rect.sh) * 100}%`,
                    }
                  : { visibility: 'hidden', width: '100%' }
              }
            />
            {/* rule-of-thirds guides */}
            <span aria-hidden className="pointer-events-none absolute inset-0 [background:linear-gradient(to_right,transparent_33.2%,rgb(255_255_255/0.22)_33.3%,transparent_33.5%,transparent_66.5%,rgb(255_255_255/0.22)_66.6%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,rgb(255_255_255/0.22)_33.3%,transparent_33.5%,transparent_66.5%,rgb(255_255_255/0.22)_66.6%,transparent_66.8%)]" />
          </div>
        )}
        {!failed && (
          <div className="mx-auto flex max-w-[20rem] items-center gap-3">
            <label htmlFor="qr-crop-zoom" className="text-sm font-medium">{t('qr.crop.zoom')}</label>
            <input
              id="qr-crop-zoom"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-11 flex-1 accent-(--color-accent)"
            />
          </div>
        )}
        <p id="qr-crop-keys" className="text-center text-xs text-muted">{t('qr.crop.keys')}</p>
        {small && <p role="note" className="rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">{t('qr.crop.small')}</p>}
        <p role="alert" className="text-sm text-bad">{error}</p>
        <p className="tabular text-center text-xs text-muted">{file.name} · {formatBytes(file.size)}</p>
      </div>
    </Dialog>
  );
}
