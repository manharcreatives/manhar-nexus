import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { StatusPill } from '../ui/StatusPill';
import { Table, Td, Th } from '../ui/Table';
import { EmptyState, ErrorState } from '../ui/states';
import { useToast } from '../ui/Toast';
import { createOffering, listOfferings, updateOffering, type Offering, type OfferingType } from './api';
import { errorMessage, KEY_PATTERN } from './helpers';
import { FormError, ListSkeleton } from './Shared';

const TYPES: OfferingType[] = ['SETUP_FEE', 'RECURRING', 'ONE_TIME', 'TRIAL'];
const MODULE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const FORM_ID = 'offering-form';

interface FormState {
  key: string;
  name: string;
  description: string;
  type: OfferingType;
  moduleKeys: string;
}
const EMPTY: FormState = { key: '', name: '', description: '', type: 'SETUP_FEE', moduleKeys: '' };

function parseModuleKeys(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map((k) => k.trim()).filter(Boolean)));
}

export function OfferingsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setOfferings(await listOfferings());
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const keys = parseModuleKeys(form.moduleKeys);
  const errors = {
    key: !form.key.trim()
      ? t('commercial.offerings.errors.keyRequired')
      : !KEY_PATTERN.test(form.key.trim())
        ? t('commercial.offerings.errors.keyFormat')
        : null,
    name: form.name.trim() ? null : t('commercial.offerings.errors.nameRequired'),
    moduleKeys: keys.some((k) => !MODULE_KEY_PATTERN.test(k))
      ? t('commercial.offerings.errors.moduleKeysFormat')
      : null,
  };
  const valid = !errors.key && !errors.name && !errors.moduleKeys;

  function openForm() {
    setForm(EMPTY);
    setSubmitted(false);
    setFormError(null);
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await createOffering({
        key: form.key.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        moduleKeys: keys,
      });
      toast.show(t('commercial.offerings.created', { name: form.name.trim() }));
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err, t('commercial.errors.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(o: Offering) {
    setTogglingId(o.id);
    try {
      await updateOffering(o.id, { isActive: !o.isActive });
      toast.show(t(o.isActive ? 'commercial.offerings.deactivated' : 'commercial.offerings.activated', { name: o.name }));
      await load();
    } catch (err) {
      toast.show(errorMessage(err, t('commercial.errors.saveFailed')), 'bad');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section aria-labelledby="offerings-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="offerings-h" className="text-xl font-semibold">
            {t('commercial.offerings.title')}
          </h2>
          <p className="text-sm text-muted">{t('commercial.offerings.help')}</p>
        </div>
        <Button onClick={openForm}>{t('commercial.offerings.add')}</Button>
      </div>

      {loadFailed ? (
        <ErrorState
          title={t('commercial.errors.loadTitle')}
          body={t('commercial.errors.loadFailed')}
          onRetry={() => void load()}
          retryLabel={t('commercial.retry')}
        />
      ) : offerings === null ? (
        <ListSkeleton label={t('commercial.loading')} />
      ) : offerings.length === 0 ? (
        <EmptyState
          title={t('commercial.offerings.emptyTitle')}
          body={t('commercial.offerings.empty')}
          action={<Button onClick={openForm}>{t('commercial.offerings.add')}</Button>}
        />
      ) : (
        <Table aria-label={t('commercial.offerings.title')}>
          <thead>
            <tr>
              <Th>{t('commercial.offerings.name')}</Th>
              <Th>{t('commercial.offerings.type')}</Th>
              <Th>{t('commercial.offerings.modules')}</Th>
              <Th>{t('commercial.col.status')}</Th>
              <Th>
                <span className="sr-only">{t('commercial.actions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {offerings.map((o) => (
              <tr key={o.id}>
                <Td>
                  <div className={o.isActive ? 'font-medium' : 'font-medium text-muted'}>{o.name}</div>
                  {o.description && <div className="text-xs text-muted">{o.description}</div>}
                  <div className="font-mono text-xs text-muted">{o.key}</div>
                </Td>
                <Td>{t(`commercial.offeringType.${o.type}`)}</Td>
                <Td>
                  {o.moduleKeys.length === 0 ? (
                    <span className="text-muted">{t('commercial.none')}</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {o.moduleKeys.map((k) => (
                        <span key={k} className="rounded-control bg-sunken px-2 py-0.5 text-xs">
                          {k}
                        </span>
                      ))}
                    </span>
                  )}
                </Td>
                <Td>
                  <StatusPill tone={o.isActive ? 'ok' : 'neutral'}>
                    {t(o.isActive ? 'commercial.active' : 'commercial.inactive')}
                  </StatusPill>
                </Td>
                <Td>
                  <Button
                    variant="ghost"
                    loading={togglingId === o.id}
                    onClick={() => void toggleActive(o)}
                    aria-label={t(o.isActive ? 'commercial.offerings.deactivateNamed' : 'commercial.offerings.activateNamed', { name: o.name })}
                  >
                    {t(o.isActive ? 'commercial.deactivate' : 'commercial.activate')}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={t('commercial.offerings.addTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {t('commercial.cancel')}
            </Button>
            <Button type="submit" form={FORM_ID} loading={saving}>
              {saving ? t('commercial.saving') : t('commercial.offerings.create')}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <Field
            label={t('commercial.offerings.name')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('commercial.offerings.namePlaceholder')}
            error={submitted ? errors.name : null}
            autoComplete="off"
          />
          <Field
            label={t('commercial.offerings.key')}
            hint={t('commercial.offerings.keyHint')}
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))}
            placeholder="restaurant-setup"
            error={submitted ? errors.key : null}
            autoComplete="off"
          />
          <Select
            label={t('commercial.offerings.type')}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as OfferingType }))}
          >
            {TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`commercial.offeringType.${k}`)}
              </option>
            ))}
          </Select>
          <Field
            label={t('commercial.offerings.moduleKeys')}
            hint={t('commercial.offerings.moduleKeysHint')}
            value={form.moduleKeys}
            onChange={(e) => setForm((f) => ({ ...f, moduleKeys: e.target.value }))}
            placeholder="restaurant, catalog"
            error={submitted ? errors.moduleKeys : null}
            autoComplete="off"
          />
          <Textarea
            label={t('commercial.offerings.description')}
            value={form.description}
            maxLength={500}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <FormError message={formError} />
        </form>
      </Dialog>
    </section>
  );
}
