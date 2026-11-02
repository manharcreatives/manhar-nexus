import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { formatMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { StatusPill } from '../ui/StatusPill';
import { useToast } from '../ui/Toast';
import { useLoad } from '../setup/useLoad';
import { assetUrl, qrApi } from './api';
import { CategoryPhotos } from './CategoryPhotos';
import { describeQrError } from './errors';
import * as Icons from './icons';
import type { ImageProblem } from './imageTools';
import { useImagePicker } from './useImagePicker';
import type { PhotoCategory, PhotoItem, UploadedPicture } from './types';

interface Upload {
  /** 0..1 */
  progress: number;
}

function PhotoTile({
  item,
  upload,
  onBlob,
  onProblem,
  onRemove,
}: {
  item: PhotoItem;
  upload?: Upload;
  onBlob: (item: PhotoItem, blob: Blob) => void;
  onProblem: (item: PhotoItem, p: ImageProblem) => void;
  onRemove: (item: PhotoItem) => void;
}) {
  const { t } = useTranslation();
  const uploading = upload !== undefined;
  const picker = useImagePicker({
    kind: 'dish',
    title: t('qr.photos.cropTitle', { name: item.name }),
    inputLabel: t('qr.photos.inputLabel', { name: item.name }),
    onBlob: (blob) => onBlob(item, blob),
    onProblem: (p) => onProblem(item, p),
    disabled: uploading,
  });
  // The grid shows the 480 px copy when the server made one; "has a photo" is about the full picture.
  const src = assetUrl(item.imageThumbUrl ?? item.imageUrl);
  const hasPhoto = Boolean(item.imageUrl);
  const pct = Math.round((upload?.progress ?? 0) * 100);

  return (
    <article
      aria-label={item.name}
      data-has-photo={hasPhoto}
      className={cn('nx-glass flex flex-col overflow-hidden rounded-panel transition-colors', picker.dragging && 'border-accent! bg-accent/10')}
      {...picker.dropProps}
    >
      <div className="relative aspect-[4/5] w-full bg-sunken">
        {src ? (
          <img src={src} alt={t('qr.photos.imageAlt', { name: item.name })} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={picker.open}
            disabled={uploading}
            aria-label={t('qr.photos.add', { name: item.name })}
            className="flex size-full flex-col items-center justify-center gap-2 border border-dashed border-white/15 p-3 text-center text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-50"
          >
            <Icons.ImagePlus className="size-7" aria-hidden />
            <span>{picker.dragging ? t('qr.photos.dropHere') : t('qr.photos.dropHint')}</span>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/65 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-40 text-center">
              <p className="tabular mb-2 text-sm font-medium" aria-live="polite">{t('qr.photos.uploading', { pct })}</p>
              <div role="progressbar" aria-label={t('qr.photos.progressLabel', { name: item.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold" title={item.name}>{item.name}</h3>
          <p className="tabular text-sm text-muted">{formatMoney(item.basePriceMinorUnits)}</p>
        </div>
        {!item.isActive && <StatusPill>{t('qr.photos.hidden')}</StatusPill>}
        <div className="mt-auto flex gap-2">
          <Button variant="secondary" className="flex-1 px-2" onClick={picker.open} disabled={uploading} aria-label={hasPhoto ? t('qr.photos.replaceAria', { name: item.name }) : t('qr.photos.addAria', { name: item.name })}>
            <Icons.Upload className="size-4" aria-hidden />
            {hasPhoto ? t('qr.photos.replace') : t('qr.photos.upload')}
          </Button>
          {hasPhoto && (
            <Button variant="ghost" className="px-3 text-bad" onClick={() => onRemove(item)} disabled={uploading} aria-label={t('qr.photos.removeAria', { name: item.name })}>
              <Icons.Trash2 className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      {picker.input}
      {picker.dialog}
    </article>
  );
}

export function PhotoManager() {
  const { t } = useTranslation();
  const toast = useToast();
  const loadItems = useCallback(() => Promise.all([qrApi.photoItems(), qrApi.photoCategories()]), []);
  const { data, loading, error, reload } = useLoad(loadItems);
  const [overrides, setOverrides] = useState<Record<string, UploadedPicture>>({});
  const [uploads, setUploads] = useState<Record<string, Upload>>({});
  const inFlight = useRef(new Set<string>());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [removing, setRemoving] = useState<PhotoItem | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const items = useMemo<PhotoItem[]>(
    () => (data?.[0] ?? []).map((i) => (i.id in overrides ? { ...i, ...overrides[i.id] } : i)),
    [data, overrides],
  );
  const categories: PhotoCategory[] = data?.[1] ?? [];

  const onProblem = useCallback(
    (item: PhotoItem, p: ImageProblem) => toast.show(t(`qr.photos.problem.${p}`, { name: item.name }), 'bad'),
    [t, toast],
  );

  const upload = useCallback(
    async (item: PhotoItem, blob: Blob) => {
      if (inFlight.current.has(item.id)) return;
      inFlight.current.add(item.id);
      setUploads((u) => ({ ...u, [item.id]: { progress: 0 } }));
      try {
        const pic = await qrApi.uploadItemImage(item.id, blob, {
          onProgress: (f) => setUploads((u) => (item.id in u ? { ...u, [item.id]: { progress: f } } : u)),
        });
        if (pic.imageUrl) setOverrides((o) => ({ ...o, [item.id]: pic }));
        else reload();
        toast.show(t('qr.photos.uploaded', { name: item.name }));
      } catch (err) {
        toast.show(describeQrError(err, t, 'qr.photos.uploadFailed'), 'bad');
      } finally {
        inFlight.current.delete(item.id);
        setUploads((u) => {
          const { [item.id]: _gone, ...rest } = u;
          return rest;
        });
      }
    },
    [reload, t, toast],
  );

  const confirmRemove = useCallback(async () => {
    const item = removing;
    if (!item || inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    setRemoveBusy(true);
    try {
      await qrApi.removeItemImage(item.id);
      setOverrides((o) => ({ ...o, [item.id]: { imageUrl: null, imageThumbUrl: null } }));
      toast.show(t('qr.photos.removed', { name: item.name }));
      setRemoving(null);
    } catch (err) {
      toast.show(describeQrError(err, t, 'qr.photos.removeFailed'), 'bad');
    } finally {
      inFlight.current.delete(item.id);
      setRemoveBusy(false);
    }
  }, [removing, t, toast]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => (!q || i.name.toLowerCase().includes(q)) && (!category || i.categoryId === category) && (!onlyMissing || !i.imageUrl),
    );
  }, [items, query, category, onlyMissing]);

  if (loading && !data) {
    return (
      <div role="status" aria-label={t('qr.common.loading')} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5]" />
        ))}
      </div>
    );
  }
  if (error && !data) {
    return <ErrorState title={t('qr.photos.loadError')} onRetry={reload} retryLabel={t('qr.common.retry')} />;
  }
  if (items.length === 0) {
    return <EmptyState title={t('qr.photos.emptyTitle')} body={t('qr.photos.emptyBody')} />;
  }

  const withPhoto = items.filter((i) => i.imageUrl).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs">
          <Field label={t('qr.photos.search')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="w-full max-w-48">
          <Select label={t('qr.photos.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('qr.photos.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <Checkbox label={t('qr.photos.onlyMissing')} checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
        <p className="tabular ml-auto text-sm text-muted" aria-live="polite">{t('qr.photos.coverage', { with: withPhoto, total: items.length })}</p>
      </div>
      <p className="max-w-prose text-sm text-muted">{t('qr.photos.tip')}</p>
      {categories.length > 0 && <CategoryPhotos categories={categories} />}

      {visible.length === 0 ? (
        <EmptyState title={t('qr.photos.noMatch')} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map((item) => (
            <li key={item.id} className="min-w-0">
              <PhotoTile item={item} upload={uploads[item.id]} onBlob={(i, b) => void upload(i, b)} onProblem={onProblem} onRemove={setRemoving} />
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <Dialog
          open
          onClose={() => !removeBusy && setRemoving(null)}
          title={t('qr.photos.removeTitle', { name: removing.name })}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRemoving(null)} disabled={removeBusy} data-autofocus>
                {t('qr.common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => void confirmRemove()} loading={removeBusy}>
                <Icons.Trash2 className="size-4" aria-hidden />
                {t('qr.photos.removeConfirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">{t('qr.photos.removeBody')}</p>
        </Dialog>
      )}
    </div>
  );
}
