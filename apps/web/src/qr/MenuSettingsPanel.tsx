import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';
import { useSingleFlight } from '../restaurant/hooks';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { SectionHeader } from '../ui/SectionHeader';
import { useToast } from '../ui/Toast';
import { assetUrl, qrApi } from './api';
import { describeQrError, isVersionConflict } from './errors';
import * as Icons from './icons';
import type { ImageProblem } from './imageTools';
import { PhonePreview } from './PhonePreview';
import { Switch } from './Switch';
import type { OrderingMode, QrSettings, QrSettingsPatch } from './types';
import { useImagePicker } from './useImagePicker';

const TAGLINE_MAX = 80;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MODES: OrderingMode[] = ['off', 'confirm', 'auto'];

function BrandImageField({
  kind,
  label,
  hint,
  url,
  onChanged,
}: {
  kind: 'logo' | 'cover';
  label: string;
  hint: string;
  url: string | null;
  /** The picture was saved or removed on the server (the settings version moved: the parent reloads). */
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const picker = useImagePicker({
    kind,
    title: t(`qr.settings.${kind}CropTitle`),
    inputLabel: t(`qr.settings.${kind}Input`),
    disabled: progress !== null,
    onProblem: (p: ImageProblem) => toast.show(t(`qr.photos.problem.${p}`, { name: label }), 'bad'),
    onBlob: async (blob) => {
      setProgress(0);
      try {
        await qrApi.uploadBrandImage(kind, blob, { onProgress: setProgress });
        onChanged();
        toast.show(t('qr.settings.imageSaved', { what: label }));
      } catch (err) {
        toast.show(describeQrError(err, t, 'qr.settings.imageFailed'), 'bad');
      } finally {
        setProgress(null);
      }
    },
  });
  const src = assetUrl(url);
  const remove = async () => {
    try {
      await qrApi.removeBrandImage(kind);
      onChanged();
    } catch (err) {
      toast.show(describeQrError(err, t, 'qr.settings.imageFailed'), 'bad');
    }
  };
  return (
    <div
      className={cn('flex items-center gap-4 rounded-panel border border-dashed p-3 transition-colors', picker.dragging ? 'border-accent bg-accent/10' : 'border-white/12')}
      {...picker.dropProps}
    >
      <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-xl bg-sunken', kind === 'logo' ? 'size-16' : 'h-16 w-28')}>
        {src ? <img src={src} alt="" className="size-full object-cover" /> : <Icons.Image className="size-6 text-muted" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted">{progress !== null ? t('qr.photos.uploading', { pct: Math.round(progress * 100) }) : hint}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={picker.open} loading={progress !== null} aria-label={t('qr.settings.chooseImage', { what: label })}>
          <Icons.Upload className="size-4" aria-hidden />
          {src ? t('qr.photos.replace') : t('qr.photos.upload')}
        </Button>
        {src && progress === null && (
          <Button variant="ghost" className="px-3 text-bad" onClick={() => void remove()} aria-label={t('qr.settings.removeImage', { what: label })}>
            <Icons.Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      {picker.input}
      {picker.dialog}
    </div>
  );
}

/** Minimal PATCH body: only what differs from what is saved. */
export function settingsDiff(saved: QrSettings, draft: QrSettings): QrSettingsPatch {
  const patch: QrSettingsPatch = {};
  if (draft.enabled !== saved.enabled) patch.enabled = draft.enabled;
  if (draft.ordering !== saved.ordering) patch.ordering = draft.ordering;
  if (draft.callWaiter !== saved.callWaiter) patch.callWaiter = draft.callWaiter;
  if (draft.upi !== saved.upi) patch.upi = draft.upi;
  if (draft.tagline.trim() !== saved.tagline) patch.tagline = draft.tagline.trim();
  if (draft.accentColor !== saved.accentColor) patch.accentColor = draft.accentColor;
  return patch;
}

export function MenuSettingsPanel({
  settings,
  businessName,
  defaultAccent,
  onSaved,
  onConflict,
}: {
  settings: QrSettings;
  businessName: string;
  /** The restaurant's own accent, used when no menu accent is chosen. */
  defaultAccent: string;
  onSaved: (next: QrSettings) => void;
  /** Another admin saved first (409 VERSION_CONFLICT): reload the server copy. */
  onConflict?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [draft, setDraft] = useState<QrSettings>(settings);
  const [error, setError] = useState('');
  const { busy, run } = useSingleFlight();

  // Pick up server-side changes (another admin, image uploads) without losing unsaved text edits.
  useEffect(() => {
    setDraft((d) => ({ ...d, logoUrl: settings.logoUrl, coverUrl: settings.coverUrl }));
  }, [settings.logoUrl, settings.coverUrl]);

  const patch = useMemo(() => settingsDiff(settings, draft), [settings, draft]);
  const dirty = Object.keys(patch).length > 0;
  const accent = draft.accentColor ?? defaultAccent;
  const hexValid = draft.accentColor === null || HEX.test(draft.accentColor);
  const set = <K extends keyof QrSettings>(k: K, v: QrSettings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /** Logo / cover saved or removed: they bump the version, so take the server copy (new URLs + version). */
  async function imageChanged() {
    try {
      onSaved(await qrApi.settings());
    } catch {
      /* the next reload picks it up */
    }
  }

  async function save() {
    if (!hexValid) return setError(t('qr.settings.accentInvalid'));
    setError('');
    await run(async () => {
      try {
        const next = await qrApi.saveSettings(patch, settings.version);
        onSaved(next);
        setDraft(next);
        toast.show(t('qr.settings.saved'));
      } catch (err) {
        setError(describeQrError(err, t, 'qr.settings.saveFailed'));
        if (isVersionConflict(err)) onConflict?.();
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <form
        className="min-w-0 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section aria-labelledby="qr-set-access" className="nx-glass space-y-5 rounded-panel p-5">
          <SectionHeader id="qr-set-access" title={t('qr.settings.accessTitle')} size="sm" />
          <Switch
            label={t('qr.settings.master')}
            hint={t('qr.settings.masterHint')}
            checked={draft.enabled}
            onChange={(v) => set('enabled', v)}
            onLabel={t('qr.common.on')}
            offLabel={t('qr.common.off')}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('qr.settings.orderingTitle')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <label
                  key={m}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 text-sm transition-colors',
                    draft.ordering === m ? 'border-accent/60 bg-accent/10' : 'border-white/10 hover:border-white/25',
                  )}
                >
                  <input type="radio" name="qr-ordering" value={m} checked={draft.ordering === m} onChange={() => set('ordering', m)} className="mt-0.5 size-4 accent-(--color-accent)" />
                  <span>
                    <span className="block font-medium">{t(`qr.settings.ordering.${m}.name`)}</span>
                    <span className="block text-muted">{t(`qr.settings.ordering.${m}.hint`)}</span>
                  </span>
                </label>
              ))}
            </div>
            {draft.ordering === 'auto' && (
              <p role="note" className="mt-3 flex gap-2 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
                <Icons.TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('qr.settings.autoWarning')}
              </p>
            )}
          </fieldset>
          <Switch label={t('qr.settings.callWaiter')} hint={t('qr.settings.callWaiterHint')} checked={draft.callWaiter} onChange={(v) => set('callWaiter', v)} onLabel={t('qr.common.on')} offLabel={t('qr.common.off')} />
          <div>
            <Switch label={t('qr.settings.upi')} hint={t('qr.settings.upiHint')} checked={draft.upi} onChange={(v) => set('upi', v)} onLabel={t('qr.common.on')} offLabel={t('qr.common.off')} />
            <Link to="/config" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong">
              {t('qr.settings.upiLink')}
              <Icons.ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </div>
        </section>

        <section aria-labelledby="qr-set-look" className="nx-glass space-y-5 rounded-panel p-5">
          <SectionHeader id="qr-set-look" title={t('qr.settings.lookTitle')} size="sm" />
          <div>
            <Field
              label={t('qr.settings.tagline')}
              value={draft.tagline}
              maxLength={TAGLINE_MAX}
              placeholder={t('qr.settings.taglinePlaceholder')}
              onChange={(e) => set('tagline', e.target.value)}
              hint={t('qr.settings.taglineCount', { count: draft.tagline.length, max: TAGLINE_MAX })}
            />
          </div>
          <BrandImageField kind="logo" label={t('qr.settings.logo')} hint={t('qr.settings.logoHint')} url={draft.logoUrl} onChanged={() => void imageChanged()} />
          <BrandImageField kind="cover" label={t('qr.settings.cover')} hint={t('qr.settings.coverHint')} url={draft.coverUrl} onChanged={() => void imageChanged()} />
          <div>
            <p className="mb-1.5 text-sm font-medium">{t('qr.settings.accent')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                aria-label={t('qr.settings.accentPicker')}
                value={HEX.test(accent) ? accent : '#22c55e'}
                onChange={(e) => set('accentColor', e.target.value)}
                className="size-11 cursor-pointer rounded-control border border-white/15 bg-transparent p-1"
              />
              <div className="w-36">
                <Field
                  label={t('qr.settings.accentHex')}
                  value={draft.accentColor ?? ''}
                  placeholder={defaultAccent}
                  onChange={(e) => set('accentColor', e.target.value.trim() === '' ? null : e.target.value.trim())}
                  error={hexValid ? null : t('qr.settings.accentInvalid')}
                  className="ticket-no"
                />
              </div>
              {draft.accentColor !== null && (
                <Button variant="ghost" onClick={() => set('accentColor', null)}>
                  {t('qr.settings.accentReset')}
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted">{t('qr.settings.accentHint')}</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={busy} disabled={!dirty || !hexValid}>
            {t('qr.settings.save')}
          </Button>
          <Button variant="secondary" size="lg" disabled={!dirty || busy} onClick={() => setDraft(settings)}>
            {t('qr.settings.discard')}
          </Button>
          <p role="status" className="text-sm text-muted">{dirty ? t('qr.settings.unsaved') : ''}</p>
        </div>
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <PhonePreview
          name={businessName}
          tagline={draft.tagline}
          logoUrl={draft.logoUrl}
          coverUrl={draft.coverUrl}
          accent={HEX.test(accent) ? accent : defaultAccent}
          ordering={draft.enabled ? draft.ordering : 'off'}
          callWaiter={draft.callWaiter}
          upi={draft.upi}
        />
      </div>
    </div>
  );
}
