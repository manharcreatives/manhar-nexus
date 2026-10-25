import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import { type DiningTable, type GuestSession, sessionApi } from './api';

export function OpenSessionDialog({
  table,
  locationId,
  onOpened,
  onCancel,
}: {
  table: DiningTable;
  locationId: string;
  onOpened: (session: GuestSession) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [partySize, setPartySize] = useState(String(Math.min(2, table.capacity)));
  const [notes, setNotes] = useState('');
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useSingleFlight();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const size = Number(partySize);
    if (!Number.isInteger(size) || size < 1 || size > table.capacity) {
      setSizeError(t('restaurant.open.partySizeError', { max: table.capacity }));
      return;
    }
    if (!locationId) {
      setError(t('restaurant.open.noLocation'));
      return;
    }
    setSizeError(null);
    setError('');
    await run(async () => {
      try {
        const session = await sessionApi.open({
          locationId,
          diningTableId: table.id,
          partySize: size,
          notes: notes.trim() || undefined,
        });
        onOpened(session);
      } catch (err) {
        setError(describeError(err, t, 'restaurant.errors.openSession'));
      }
    });
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t('restaurant.open.title', { code: table.code })}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            {t('restaurant.common.cancel')}
          </Button>
          <Button type="submit" form={formId} size="lg" loading={busy}>
            {busy ? t('restaurant.open.submitting') : t('restaurant.open.submit')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <p className="text-sm text-muted">{t('restaurant.open.capacity', { count: table.capacity })}</p>
        <Field
          label={t('restaurant.open.partySize')}
          type="number"
          inputMode="numeric"
          min={1}
          max={table.capacity}
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          error={sizeError}
          className="tabular"
        />
        <Field
          label={t('restaurant.open.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('restaurant.open.notesPlaceholder')}
        />
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      </form>
    </Dialog>
  );
}
