import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import * as Icons from './icons';
import { QrSvg } from './QrSvg';
import { tableMenuUrl } from './qrCode';
import type { QrTable } from './types';

export interface TableQrCardProps {
  table: QrTable;
  /** Per-card in-flight flag (rotate / toggle running). */
  busy?: boolean;
  onCopy: (t: QrTable) => void;
  onDownload: (t: QrTable, format: 'png' | 'svg') => void;
  onPrintTent: (t: QrTable) => void;
  onRotate: (t: QrTable) => void;
  onToggle: (t: QrTable) => void;
  /** Guest ordering on/off for this table; omit to hide the control (ordering is off restaurant-wide). */
  onToggleOrdering?: (t: QrTable) => void;
}

/** One table: live QR, status, and the actions staff need (copy, download, tent, rotate, on/off). */
export function TableQrCard({ table, busy, onCopy, onDownload, onPrintTent, onRotate, onToggle, onToggleOrdering }: TableQrCardProps) {
  const { t } = useTranslation();
  const url = tableMenuUrl(table);
  const tail = table.token.slice(-6);
  return (
    <article
      aria-label={t('qr.card.aria', { code: table.code })}
      data-enabled={table.enabled}
      className="nx-glass flex flex-col rounded-panel p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[1.75rem] leading-none font-semibold tracking-[-0.02em]">{table.code}</h3>
          {table.areaName && <p className="mt-1.5 truncate text-sm text-muted">{table.areaName}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill tone={table.enabled ? 'ok' : 'neutral'}>{table.enabled ? t('qr.card.enabled') : t('qr.card.disabled')}</StatusPill>
          {table.enabled && !table.orderingEnabled && <StatusPill tone="warn">{t('qr.card.browseOnly')}</StatusPill>}
        </div>
      </header>

      <div className="relative mx-auto mt-4 w-full max-w-[11rem]">
        <div className={cn('rounded-[0.875rem] bg-white p-1.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.7)] transition-opacity', !table.enabled && 'opacity-30')}>
          <QrSvg text={url} label={t('qr.card.qrLabel', { code: table.code })} className="block aspect-square w-full" />
        </div>
        {!table.enabled && (
          <span className="absolute inset-0 grid place-items-center text-center text-sm font-semibold text-ink [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">
            {t('qr.card.offOverlay')}
          </span>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        <span className="ticket-no" title={url}>/m/…{tail}</span>
        {table.rotatedAt && <span> · {t('qr.card.rotated', { date: new Date(table.rotatedAt).toLocaleDateString() })}</span>}
      </p>

      {(table.pendingGuestOrders > 0 || table.waiterCall) && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {table.pendingGuestOrders > 0 && <StatusPill tone="accent">{t('qr.card.pending', { count: table.pendingGuestOrders })}</StatusPill>}
          {table.waiterCall && <StatusPill tone="warn">{t(`qr.alerts.reason.${table.waiterCall.reason}`)}</StatusPill>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => onCopy(table)} aria-label={t('qr.card.copyAria', { code: table.code })}>
          <Icons.Copy className="size-4" aria-hidden />
          {t('qr.card.copy')}
        </Button>
        <Button variant="secondary" onClick={() => onPrintTent(table)} aria-label={t('qr.card.tentAria', { code: table.code })}>
          <Icons.Printer className="size-4" aria-hidden />
          {t('qr.card.tent')}
        </Button>
        <Button variant="secondary" onClick={() => onDownload(table, 'png')} aria-label={t('qr.card.pngAria', { code: table.code })}>
          <Icons.Download className="size-4" aria-hidden />
          PNG
        </Button>
        <Button variant="secondary" onClick={() => onDownload(table, 'svg')} aria-label={t('qr.card.svgAria', { code: table.code })}>
          <Icons.Download className="size-4" aria-hidden />
          SVG
        </Button>
      </div>
      {onToggleOrdering && table.enabled && (
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start"
          disabled={busy}
          onClick={() => onToggleOrdering(table)}
          aria-pressed={table.orderingEnabled}
          aria-label={table.orderingEnabled ? t('qr.card.orderingOffAria', { code: table.code }) : t('qr.card.orderingOnAria', { code: table.code })}
        >
          <Icons.ShoppingBag className="size-4" aria-hidden />
          {table.orderingEnabled ? t('qr.card.orderingOn') : t('qr.card.orderingOff')}
        </Button>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
        <Button variant="ghost" loading={busy} onClick={() => onToggle(table)} aria-pressed={table.enabled} aria-label={table.enabled ? t('qr.card.disableAria', { code: table.code }) : t('qr.card.enableAria', { code: table.code })}>
          <Icons.Power className="size-4" aria-hidden />
          {table.enabled ? t('qr.card.disable') : t('qr.card.enable')}
        </Button>
        <Button variant="ghost" disabled={busy} className="text-warn" onClick={() => onRotate(table)} aria-label={t('qr.card.rotateAria', { code: table.code })}>
          <Icons.RotateCw className="size-4" aria-hidden />
          {t('qr.card.rotate')}
        </Button>
      </div>
    </article>
  );
}
