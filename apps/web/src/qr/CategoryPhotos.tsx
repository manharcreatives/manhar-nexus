import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { assetUrl, qrApi } from './api';
import { describeQrError } from './errors';
import * as Icons from './icons';
import type { ImageProblem } from './imageTools';
import type { PhotoCategory } from './types';
import { useImagePicker } from './useImagePicker';

function CategoryRow({ category, imageUrl, onChanged }: { category: PhotoCategory; imageUrl: string | null; onChanged: (id: string, url: string | null) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const picker = useImagePicker({
    kind: 'category',
    title: t('qr.categories.cropTitle', { name: category.name }),
    inputLabel: t('qr.categories.inputLabel', { name: category.name }),
    disabled: progress !== null,
    onProblem: (p: ImageProblem) => toast.show(t(`qr.photos.problem.${p}`, { name: category.name }), 'bad'),
    onBlob: async (blob) => {
      setProgress(0);
      try {
        const pic = await qrApi.uploadCategoryImage(category.id, blob, { onProgress: setProgress });
        onChanged(category.id, pic.imageUrl);
        toast.show(t('qr.categories.saved', { name: category.name }));
      } catch (err) {
        toast.show(describeQrError(err, t, 'qr.categories.saveFailed'), 'bad');
      } finally {
        setProgress(null);
      }
    },
  });
  const src = assetUrl(imageUrl);
  async function remove() {
    try {
      await qrApi.removeCategoryImage(category.id);
      onChanged(category.id, null);
    } catch (err) {
      toast.show(describeQrError(err, t, 'qr.categories.saveFailed'), 'bad');
    }
  }
  return (
    <li className="flex items-center gap-3 rounded-control border border-white/10 p-2" {...picker.dropProps}>
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-sunken">
        {src ? <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : <Icons.Image className="size-5 text-muted" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{category.name}</p>
        <p className="text-xs text-muted">{progress !== null ? t('qr.photos.uploading', { pct: Math.round(progress * 100) }) : src ? t('qr.categories.has') : t('qr.categories.none')}</p>
      </div>
      <Button variant="secondary" className="px-3" onClick={picker.open} loading={progress !== null} aria-label={t('qr.categories.chooseAria', { name: category.name })}>
        <Icons.Upload className="size-4" aria-hidden />
        {src ? t('qr.photos.replace') : t('qr.photos.upload')}
      </Button>
      {src && progress === null && (
        <Button variant="ghost" className="px-3 text-bad" onClick={() => void remove()} aria-label={t('qr.categories.removeAria', { name: category.name })}>
          <Icons.Trash2 className="size-4" aria-hidden />
        </Button>
      )}
      {picker.input}
      {picker.dialog}
    </li>
  );
}

/** Optional square picture per category (shown on the guest menu's category rail). Collapsed by default. */
export function CategoryPhotos({ categories }: { categories: PhotoCategory[] }) {
  const { t } = useTranslation();
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const withPicture = categories.filter((c) => (c.id in urls ? urls[c.id] : c.imageUrl)).length;
  return (
    <details className="nx-glass rounded-panel p-4">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
        <span>{t('qr.categories.title')}</span>
        <span className="tabular text-muted">{t('qr.categories.coverage', { with: withPicture, total: categories.length })}</span>
      </summary>
      <p className="mt-2 mb-3 max-w-prose text-sm text-muted">{t('qr.categories.hint')}</p>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} imageUrl={c.id in urls ? urls[c.id] : c.imageUrl} onChanged={(id, url) => setUrls((u) => ({ ...u, [id]: url }))} />
        ))}
      </ul>
    </details>
  );
}
