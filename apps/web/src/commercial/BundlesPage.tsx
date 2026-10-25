import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { StatusPill } from '../ui/StatusPill';
import { Textarea } from '../ui/Textarea';
import { EmptyState, ErrorState } from '../ui/states';
import { useToast } from '../ui/Toast';
import {
  addBundleItem,
  createBundle,
  listBundles,
  listOfferings,
  removeBundleItem,
  type Bundle,
  type Offering,
} from './api';
import { errorMessage, KEY_PATTERN } from './helpers';
import { FormError, ListSkeleton } from './Shared';

const FORM_ID = 'bundle-form';

export function BundlesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Bundle | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringsFailed, setOfferingsFailed] = useState(false);
  const [busyOffering, setBusyOffering] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const rows = await listBundles();
      setBundles(rows);
      return rows;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const errors = {
    key: !form.key.trim()
      ? t('commercial.bundles.errors.keyRequired')
      : !KEY_PATTERN.test(form.key.trim())
        ? t('commercial.bundles.errors.keyFormat')
        : null,
    name: form.name.trim() ? null : t('commercial.bundles.errors.nameRequired'),
  };

  function openForm() {
    setForm({ key: '', name: '', description: '' });
    setSubmitted(false);
    setFormError(null);
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.key || errors.name || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await createBundle({
        key: form.key.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      toast.show(t('commercial.bundles.created', { name: form.name.trim() }));
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err, t('commercial.errors.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function openEditor(b: Bundle) {
    setEditing(b);
    setOfferingsFailed(false);
    try {
      setOfferings((await listOfferings()).filter((o) => o.isActive));
    } catch {
      setOfferingsFailed(true);
    }
  }

  async function toggleItem(b: Bundle, o: Offering, include: boolean) {
    setBusyOffering(o.id);
    try {
      if (include) await addBundleItem(b.id, o.id);
      else await removeBundleItem(b.id, o.id);
      const rows = await load();
      const fresh = rows?.find((x) => x.id === b.id);
      if (fresh) setEditing(fresh);
      toast.show(t(include ? 'commercial.bundles.itemAdded' : 'commercial.bundles.itemRemoved', { name: o.name }));
    } catch (err) {
      toast.show(errorMessage(err, t('commercial.errors.saveFailed')), 'bad');
    } finally {
      setBusyOffering(null);
    }
  }

  const included = new Set(editing?.items.map((i) => i.offeringId));

  return (
    <section aria-labelledby="bundles-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="bundles-h" className="text-xl font-semibold">
            {t('commercial.bundles.title')}
          </h2>
          <p className="text-sm text-muted">{t('commercial.bundles.help')}</p>
        </div>
        <Button onClick={openForm}>{t('commercial.bundles.add')}</Button>
      </div>

      {loadFailed ? (
        <ErrorState
          title={t('commercial.errors.loadTitle')}
          body={t('commercial.errors.loadFailed')}
          onRetry={() => void load()}
          retryLabel={t('commercial.retry')}
        />
      ) : bundles === null ? (
        <ListSkeleton label={t('commercial.loading')} rows={3} />
      ) : bundles.length === 0 ? (
        <EmptyState
          title={t('commercial.bundles.emptyTitle')}
          body={t('commercial.bundles.empty')}
          action={<Button onClick={openForm}>{t('commercial.bundles.add')}</Button>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {bundles.map((b) => (
            <li key={b.id}>
              <Panel className="h-full">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{b.name}</h3>
                  <StatusPill tone={b.isActive ? 'ok' : 'neutral'}>
                    {t(b.isActive ? 'commercial.active' : 'commercial.inactive')}
                  </StatusPill>
                </div>
                <p className="font-mono text-xs text-muted">{b.key}</p>
                {b.description && <p className="mt-2 text-sm text-muted">{b.description}</p>}
                <div className="mt-3">
                  {b.items.length === 0 ? (
                    <p className="text-sm text-muted">{t('commercial.bundles.noItems')}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5" aria-label={t('commercial.bundles.includes')}>
                      {b.items.map((item) => (
                        <li key={item.offeringId} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs">
                          {item.offering.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button variant="secondary" className="mt-4" onClick={() => void openEditor(b)}>
                  {t('commercial.bundles.edit')}
                </Button>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={t('commercial.bundles.addTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {t('commercial.cancel')}
            </Button>
            <Button type="submit" form={FORM_ID} loading={saving}>
              {saving ? t('commercial.saving') : t('commercial.bundles.create')}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <Field
            label={t('commercial.bundles.name')}
            value={form.name}
            placeholder={t('commercial.bundles.namePlaceholder')}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={submitted ? errors.name : null}
            autoComplete="off"
          />
          <Field
            label={t('commercial.bundles.key')}
            hint={t('commercial.bundles.keyHint')}
            value={form.key}
            placeholder="restaurant-starter"
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))}
            error={submitted ? errors.key : null}
            autoComplete="off"
          />
          <Textarea
            label={t('commercial.bundles.description')}
            value={form.description}
            maxLength={500}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <FormError message={formError} />
        </form>
      </Dialog>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('commercial.bundles.editTitle', { name: editing?.name ?? '' })}
        footer={<Button onClick={() => setEditing(null)}>{t('commercial.done')}</Button>}
      >
        <p className="mb-2 text-sm text-muted">{t('commercial.bundles.editHelp')}</p>
        {offeringsFailed ? (
          <FormError message={t('commercial.bundles.offeringsFailed')} />
        ) : offerings.length === 0 ? (
          <p className="text-sm text-muted">{t('commercial.bundles.noOfferings')}</p>
        ) : (
          <fieldset aria-busy={!!busyOffering}>
            <legend className="sr-only">{t('commercial.bundles.includes')}</legend>
            <div className="max-h-72 overflow-y-auto">
              {editing &&
                offerings.map((o) => (
                  <Checkbox
                    key={o.id}
                    label={o.name}
                    checked={included.has(o.id)}
                    disabled={busyOffering !== null}
                    onChange={(e) => void toggleItem(editing, o, e.target.checked)}
                  />
                ))}
            </div>
          </fieldset>
        )}
      </Dialog>
    </section>
  );
}
