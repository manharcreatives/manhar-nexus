import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { StatusPill } from '../ui/StatusPill';
import { Table, Td, Th } from '../ui/Table';
import { Panel } from '../ui/Panel';
import { EmptyState, ErrorState } from '../ui/states';
import { useToast } from '../ui/Toast';
import {
  addPriceBookEntry,
  createPriceBook,
  deletePriceBookEntry,
  listOfferings,
  listPriceBooks,
  type Offering,
  type PriceBook,
  type PriceBookEntry,
} from './api';
import { errorMessage, toMinorUnits } from './helpers';
import { FormError, ListSkeleton } from './Shared';

const BOOK_FORM = 'price-book-form';
const ENTRY_FORM = 'price-entry-form';

export function PriceBooksPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [books, setBooks] = useState<PriceBook[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [bookOpen, setBookOpen] = useState(false);
  const [book, setBook] = useState({ name: '', currencyCode: 'INR', isDefault: false });
  const [bookSubmitted, setBookSubmitted] = useState(false);
  const [bookSaving, setBookSaving] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const [entryBook, setEntryBook] = useState<PriceBook | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringsFailed, setOfferingsFailed] = useState(false);
  const [entry, setEntry] = useState({ offeringId: '', amount: '', period: '' });
  const [entrySubmitted, setEntrySubmitted] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const [removing, setRemoving] = useState<{ book: PriceBook; entry: PriceBookEntry } | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setBooks(await listPriceBooks());
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bookErrors = {
    name: book.name.trim() ? null : t('commercial.priceBooks.errors.nameRequired'),
    currency: /^[A-Za-z]{3}$/.test(book.currencyCode) ? null : t('commercial.priceBooks.errors.currency'),
  };

  function openBook() {
    setBook({ name: '', currencyCode: 'INR', isDefault: false });
    setBookSubmitted(false);
    setBookError(null);
    setBookOpen(true);
  }

  async function submitBook(e: FormEvent) {
    e.preventDefault();
    setBookSubmitted(true);
    if (bookErrors.name || bookErrors.currency || bookSaving) return;
    setBookSaving(true);
    setBookError(null);
    try {
      await createPriceBook({
        name: book.name.trim(),
        currencyCode: book.currencyCode.toUpperCase(),
        isDefault: book.isDefault,
      });
      toast.show(t('commercial.priceBooks.created', { name: book.name.trim() }));
      setBookOpen(false);
      await load();
    } catch (err) {
      setBookError(errorMessage(err, t('commercial.errors.saveFailed')));
    } finally {
      setBookSaving(false);
    }
  }

  async function openEntry(b: PriceBook) {
    setEntryBook(b);
    setEntry({ offeringId: '', amount: '', period: '' });
    setEntrySubmitted(false);
    setEntryError(null);
    setOfferingsFailed(false);
    try {
      setOfferings((await listOfferings()).filter((o) => o.isActive));
    } catch {
      setOfferingsFailed(true);
    }
  }

  const minor = toMinorUnits(entry.amount);
  const periodNum = entry.period.trim() === '' ? undefined : Number(entry.period);
  const entryErrors = {
    offering: entry.offeringId ? null : t('commercial.priceBooks.errors.offeringRequired'),
    amount: minor === null ? t('commercial.priceBooks.errors.amount') : null,
    period:
      periodNum !== undefined && (!Number.isInteger(periodNum) || periodNum < 1)
        ? t('commercial.priceBooks.errors.period')
        : null,
  };

  async function submitEntry(e: FormEvent) {
    e.preventDefault();
    setEntrySubmitted(true);
    if (!entryBook || entrySaving || entryErrors.offering || entryErrors.amount || entryErrors.period || minor === null) return;
    setEntrySaving(true);
    setEntryError(null);
    try {
      await addPriceBookEntry(entryBook.id, {
        offeringId: entry.offeringId,
        amountMinorUnits: minor,
        billingPeriodDays: periodNum,
      });
      toast.show(t('commercial.priceBooks.priceAdded'));
      setEntryBook(null);
      await load();
    } catch (err) {
      setEntryError(errorMessage(err, t('commercial.errors.saveFailed')));
    } finally {
      setEntrySaving(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await deletePriceBookEntry(removing.book.id, removing.entry.id);
      toast.show(t('commercial.priceBooks.priceRemoved'));
      setRemoving(null);
      await load();
    } catch (err) {
      toast.show(errorMessage(err, t('commercial.errors.saveFailed')), 'bad');
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <section aria-labelledby="pb-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="pb-h" className="text-xl font-semibold">
            {t('commercial.priceBooks.title')}
          </h2>
          <p className="text-sm text-muted">{t('commercial.priceBooks.help')}</p>
        </div>
        <Button onClick={openBook}>{t('commercial.priceBooks.add')}</Button>
      </div>

      {loadFailed ? (
        <ErrorState
          title={t('commercial.errors.loadTitle')}
          body={t('commercial.errors.loadFailed')}
          onRetry={() => void load()}
          retryLabel={t('commercial.retry')}
        />
      ) : books === null ? (
        <ListSkeleton label={t('commercial.loading')} rows={3} />
      ) : books.length === 0 ? (
        <EmptyState
          title={t('commercial.priceBooks.emptyTitle')}
          body={t('commercial.priceBooks.empty')}
          action={<Button onClick={openBook}>{t('commercial.priceBooks.add')}</Button>}
        />
      ) : (
        <div className="space-y-4">
          {books.map((b) => (
            <Panel key={b.id} className={b.isDefault ? 'border-accent' : undefined}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{b.name}</h3>
                  <span className="text-sm text-muted">{b.currencyCode}</span>
                  {b.isDefault && <StatusPill tone="accent">{t('commercial.priceBooks.default')}</StatusPill>}
                  {!b.isActive && <StatusPill>{t('commercial.inactive')}</StatusPill>}
                </div>
                <Button variant="secondary" onClick={() => void openEntry(b)}>
                  {t('commercial.priceBooks.addPrice')}
                </Button>
              </div>
              {b.entries.length === 0 ? (
                <p className="text-sm text-muted">{t('commercial.priceBooks.noEntries')}</p>
              ) : (
                <Table aria-label={t('commercial.priceBooks.entriesLabel', { name: b.name })}>
                  <thead>
                    <tr>
                      <Th>{t('commercial.priceBooks.offering')}</Th>
                      <Th numeric>{t('commercial.priceBooks.amount')}</Th>
                      <Th>{t('commercial.priceBooks.billing')}</Th>
                      <Th>
                        <span className="sr-only">{t('commercial.actions')}</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.entries.map((en) => (
                      <tr key={en.id}>
                        <Td>{en.offering?.name ?? t('commercial.priceBooks.unknownOffering')}</Td>
                        <Td numeric>{formatMoney(en.amountMinorUnits, b.currencyCode)}</Td>
                        <Td>
                          {en.billingPeriodDays
                            ? t('commercial.priceBooks.everyDays', { count: en.billingPeriodDays })
                            : t('commercial.priceBooks.oneOff')}
                        </Td>
                        <Td>
                          <Button
                            variant="ghost"
                            onClick={() => setRemoving({ book: b, entry: en })}
                            aria-label={t('commercial.priceBooks.removeNamed', { name: en.offering?.name ?? '' })}
                          >
                            {t('commercial.remove')}
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
          ))}
        </div>
      )}

      <Dialog
        open={bookOpen}
        onClose={() => !bookSaving && setBookOpen(false)}
        title={t('commercial.priceBooks.addTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBookOpen(false)} disabled={bookSaving}>
              {t('commercial.cancel')}
            </Button>
            <Button type="submit" form={BOOK_FORM} loading={bookSaving}>
              {bookSaving ? t('commercial.saving') : t('commercial.priceBooks.create')}
            </Button>
          </>
        }
      >
        <form id={BOOK_FORM} onSubmit={(e) => void submitBook(e)} noValidate className="space-y-4">
          <Field
            label={t('commercial.priceBooks.name')}
            value={book.name}
            placeholder={t('commercial.priceBooks.namePlaceholder')}
            onChange={(e) => setBook((f) => ({ ...f, name: e.target.value }))}
            error={bookSubmitted ? bookErrors.name : null}
            autoComplete="off"
          />
          <Field
            label={t('commercial.priceBooks.currency')}
            hint={t('commercial.priceBooks.currencyHint')}
            value={book.currencyCode}
            maxLength={3}
            onChange={(e) => setBook((f) => ({ ...f, currencyCode: e.target.value.toUpperCase() }))}
            error={bookSubmitted ? bookErrors.currency : null}
            autoComplete="off"
          />
          <Checkbox
            label={t('commercial.priceBooks.makeDefault')}
            checked={book.isDefault}
            onChange={(e) => setBook((f) => ({ ...f, isDefault: e.target.checked }))}
          />
          <FormError message={bookError} />
        </form>
      </Dialog>

      <Dialog
        open={!!entryBook}
        onClose={() => !entrySaving && setEntryBook(null)}
        title={t('commercial.priceBooks.addPriceTitle', { name: entryBook?.name ?? '' })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEntryBook(null)} disabled={entrySaving}>
              {t('commercial.cancel')}
            </Button>
            <Button type="submit" form={ENTRY_FORM} loading={entrySaving} disabled={offeringsFailed}>
              {entrySaving ? t('commercial.saving') : t('commercial.priceBooks.savePrice')}
            </Button>
          </>
        }
      >
        <form id={ENTRY_FORM} onSubmit={(e) => void submitEntry(e)} noValidate className="space-y-4">
          {offeringsFailed && <FormError message={t('commercial.priceBooks.offeringsFailed')} />}
          <Select
            label={t('commercial.priceBooks.offering')}
            value={entry.offeringId}
            onChange={(e) => setEntry((f) => ({ ...f, offeringId: e.target.value }))}
            error={entrySubmitted ? entryErrors.offering : null}
          >
            <option value="">{t('commercial.priceBooks.chooseOffering')}</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Field
            label={t('commercial.priceBooks.amountLabel', { currency: entryBook?.currencyCode ?? '' })}
            hint={
              minor !== null && entryBook
                ? t('commercial.priceBooks.willShowAs', { value: formatMoney(minor, entryBook.currencyCode) })
                : t('commercial.priceBooks.amountHint')
            }
            inputMode="decimal"
            value={entry.amount}
            onChange={(e) => setEntry((f) => ({ ...f, amount: e.target.value }))}
            error={entrySubmitted ? entryErrors.amount : null}
            autoComplete="off"
          />
          <Field
            label={t('commercial.priceBooks.periodLabel')}
            hint={t('commercial.priceBooks.periodHint')}
            inputMode="numeric"
            value={entry.period}
            onChange={(e) => setEntry((f) => ({ ...f, period: e.target.value }))}
            error={entrySubmitted ? entryErrors.period : null}
            autoComplete="off"
          />
          <FormError message={entryError} />
        </form>
      </Dialog>

      <Dialog
        open={!!removing}
        onClose={() => !removeBusy && setRemoving(null)}
        title={t('commercial.priceBooks.removeTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)} disabled={removeBusy}>
              {t('commercial.cancel')}
            </Button>
            <Button variant="danger" loading={removeBusy} onClick={() => void confirmRemove()}>
              {t('commercial.remove')}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {t('commercial.priceBooks.removeBody', {
            offering: removing?.entry.offering?.name ?? '',
            book: removing?.book.name ?? '',
          })}
        </p>
      </Dialog>
    </section>
  );
}
