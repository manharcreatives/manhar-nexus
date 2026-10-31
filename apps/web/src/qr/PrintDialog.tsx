import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import * as Icons from './icons';
import { PrintPages, type PrintBrand } from './PrintPages';
import { PAGE_NAME, PER_PAGE, PRINT_LAYOUTS, pageCount, printableTables, TENT_WIDTH_MM, type PrintLayout } from './printLayout';
import { isLocalOrigin } from './qrCode';
import type { QrTable } from './types';

/**
 * Mounts the print pages under <body>, hides the app for print (qr.css), opens the browser
 * print dialog once fonts and logos are ready, and tears everything down on `afterprint`.
 */
export function PrintPortal({ tables, layout, brand, onDone }: { tables: QrTable[]; layout: PrintLayout; brand: PrintBrand; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.body.classList.remove('qr-printing');
      doneRef.current();
    };
    document.body.classList.add('qr-printing');
    window.addEventListener('afterprint', finish, { once: true });

    const images = () => Array.from(root.current?.querySelectorAll('img') ?? []).filter((i) => !i.complete);
    const ready = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* fonts API unavailable: print anyway */
      }
      await Promise.all(images().map((img) => new Promise<void>((res) => { img.onload = img.onerror = () => res(); })));
    };
    void ready().then(() => {
      if (finished) return;
      timer = setTimeout(() => {
        try {
          window.print();
        } catch {
          finish();
        }
        // Browsers that never fire afterprint (some mobile ones): release after a grace period.
        if (!('onafterprint' in window)) timer = setTimeout(finish, 1500);
      }, 120);
    });
    return () => {
      finished = true;
      clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
      document.body.classList.remove('qr-printing');
    };
  }, []);

  return createPortal(
    <div ref={root} className="qr-print-root" data-layout={layout} data-page-name={PAGE_NAME[layout]} aria-hidden>
      <PrintPages tables={tables} layout={layout} brand={brand} />
    </div>,
    document.body,
  );
}

/** Natural page size in mm per layout, used to scale the on-screen preview. */
const PAGE_MM: Record<PrintLayout, { w: number; h: number; scale: number }> = {
  sheet6: { w: 210, h: 297, scale: 0.4 },
  sheet8: { w: 210, h: 297, scale: 0.4 },
  tent: { w: TENT_WIDTH_MM, h: 150, scale: 0.75 },
};
const PX_PER_MM = 3.7795;

function Preview({ tables, layout, brand }: { tables: QrTable[]; layout: PrintLayout; brand: PrintBrand }) {
  const { t } = useTranslation();
  const m = PAGE_MM[layout];
  const first = tables.slice(0, PER_PAGE[layout]);
  if (first.length === 0) return null;
  const pad = 12;
  return (
    <div
      className="qr-preview"
      role="img"
      aria-label={t('qr.print.previewLabel')}
      style={{ width: (m.w + pad) * PX_PER_MM * m.scale, height: (m.h + pad) * PX_PER_MM * m.scale }}
    >
      <div className="qr-preview-stage" style={{ transform: `scale(${m.scale})` }} aria-hidden>
        <PrintPages tables={first} layout={layout} brand={brand} />
      </div>
    </div>
  );
}

export function PrintDialog({
  tables,
  brand,
  initialLayout = 'sheet6',
  onPrint,
  onClose,
}: {
  tables: QrTable[];
  brand: PrintBrand;
  initialLayout?: PrintLayout;
  /** Called with the final selection; the page mounts the PrintPortal. */
  onPrint: (selection: { tables: QrTable[]; layout: PrintLayout }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<PrintLayout>(initialLayout);
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const hasDisabled = tables.some((tb) => !tb.enabled);
  const selected = useMemo(() => printableTables(tables, includeDisabled), [tables, includeDisabled]);
  const pages = pageCount(selected.length, layout);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('qr.print.title')}
      className="sm:w-[46rem]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('qr.common.cancel')}
          </Button>
          <Button disabled={selected.length === 0} onClick={() => onPrint({ tables: selected, layout })} data-autofocus>
            <Icons.Printer className="size-4" aria-hidden />
            {t('qr.print.printAction', { count: pages })}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('qr.print.layout')}</legend>
            <div className="grid gap-2">
              {PRINT_LAYOUTS.map((l) => (
                <label
                  key={l}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 text-sm transition-colors',
                    layout === l ? 'border-accent/60 bg-accent/10' : 'border-white/10 hover:border-white/25',
                  )}
                >
                  <input type="radio" name="qr-layout" value={l} checked={layout === l} onChange={() => setLayout(l)} className="mt-0.5 size-4 accent-(--color-accent)" />
                  <span>
                    <span className="block font-medium">{t(`qr.print.layouts.${l}.name`)}</span>
                    <span className="block text-muted">{t(`qr.print.layouts.${l}.hint`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {hasDisabled && (
            <Checkbox label={t('qr.print.includeDisabled')} checked={includeDisabled} onChange={(e) => setIncludeDisabled(e.target.checked)} />
          )}
          <p className="tabular text-sm text-muted" aria-live="polite">
            {selected.length === 0 ? t('qr.print.nothing') : t('qr.print.summary', { count: selected.length, pages })}
          </p>
          {isLocalOrigin() && (
            <p role="note" className="flex gap-2 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
              <Icons.TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('qr.print.localWarning')}
            </p>
          )}
        </div>
        <div className="justify-self-center">
          <Preview tables={selected} layout={layout} brand={brand} />
        </div>
      </div>
    </Dialog>
  );
}
