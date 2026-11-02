import { useTranslation } from 'react-i18next';
import { QrSvg } from './QrSvg';
import { assetUrl } from './api';
import { PER_PAGE, chunk, pageClass, type PrintLayout } from './printLayout';
import { tableMenuUrl } from './qrCode';
import type { QrTable } from './types';
import './qr.css';

export interface PrintBrand {
  name: string;
  tagline: string;
  logoUrl: string | null;
  /** Restaurant accent (hairline only). */
  accent: string;
}

export function PrintCard({ table, brand, origin }: { table: QrTable; brand: PrintBrand; origin?: string }) {
  const { t } = useTranslation();
  const logo = assetUrl(brand.logoUrl);
  return (
    <article className="qr-card" style={{ ['--qr-accent' as string]: brand.accent }} data-table={table.code}>
      <div className="qr-card__top">
        <div className="qr-card__brand">
          {logo && <img src={logo} alt="" className="qr-card__logo" crossOrigin="anonymous" />}
          <span className="qr-card__name">{brand.name}</span>
        </div>
        {brand.tagline && <p className="qr-card__tagline">{brand.tagline}</p>}
      </div>
      <div className="qr-card__frame">
        <QrSvg className="qr-card__qr" text={tableMenuUrl(table, origin)} label={t('qr.print.qrLabel', { code: table.code })} />
      </div>
      <div className="qr-card__bottom">
        <p className="qr-card__eyebrow">{t('qr.print.scan')}</p>
        <p className="qr-card__table">
          <span className="qr-card__table-label">{t('qr.print.table')}</span>
          <span className="qr-card__table-code">{table.code}</span>
        </p>
        <p className="qr-card__hint">{t('qr.print.hint')}</p>
        <p className="qr-card__foot">{t('qr.print.foot')}</p>
      </div>
    </article>
  );
}

/** All pages for a layout. One `.qr-print-page` per sheet (6/8 up) or per tent card. */
export function PrintPages({ tables, layout, brand, origin }: { tables: QrTable[]; layout: PrintLayout; brand: PrintBrand; origin?: string }) {
  const pages = chunk(tables, PER_PAGE[layout]);
  return (
    <>
      {pages.map((group, i) => (
        <section key={i} className={pageClass(layout)} data-layout={layout} data-page={i + 1}>
          {group.map((table) => (
            <PrintCard key={table.tableId} table={table} brand={brand} origin={origin} />
          ))}
        </section>
      ))}
    </>
  );
}
