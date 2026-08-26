/**
 * Phase 10 — Certified ESC/POS printer compatibility matrix.
 *
 * Only models on this list are officially supported for Phase 10.
 * Additional models can be added after hardware validation.
 *
 * Evidence requirement: a model must be physically tested (not simulated)
 * before being marked CERTIFIED. Use UNVERIFIED for declared-compatible
 * but untested models.
 */

export type CompatibilityStatus = 'CERTIFIED' | 'UNVERIFIED' | 'UNSUPPORTED';

export interface CertifiedPrinterModel {
  id: string;
  manufacturer: string;
  model: string;
  paperWidthMm: 58 | 80;
  supportedConnections: Array<'NETWORK_ESC_POS' | 'USB_ESC_POS'>;
  cutter: boolean;
  cashDrawer: boolean;
  /** Character encoding the printer natively handles for Devanagari/Latin. */
  encoding: string;
  status: CompatibilityStatus;
  notes?: string;
}

export const CERTIFIED_PRINTER_MODELS: CertifiedPrinterModel[] = [
  {
    id: 'epson-tm-t88v',
    manufacturer: 'Epson',
    model: 'TM-T88V',
    paperWidthMm: 80,
    supportedConnections: ['NETWORK_ESC_POS', 'USB_ESC_POS'],
    cutter: true,
    cashDrawer: true,
    encoding: 'PC437',
    status: 'UNVERIFIED',
    notes: 'Industry standard; high confidence of compatibility. Requires physical test.',
  },
  {
    id: 'star-tsp654ii',
    manufacturer: 'Star Micronics',
    model: 'TSP654II',
    paperWidthMm: 80,
    supportedConnections: ['NETWORK_ESC_POS', 'USB_ESC_POS'],
    cutter: true,
    cashDrawer: true,
    encoding: 'PC437',
    status: 'UNVERIFIED',
    notes: 'Star-emu mode required for ESC/POS. Requires physical test.',
  },
  {
    id: 'generic-80mm-escpos',
    manufacturer: 'Generic',
    model: 'Generic 80mm ESC/POS',
    paperWidthMm: 80,
    supportedConnections: ['USB_ESC_POS'],
    cutter: false,
    cashDrawer: false,
    encoding: 'PC437',
    status: 'UNVERIFIED',
    notes: 'Common low-cost thermal USB printers sold in India. Requires physical test.',
  },
  {
    id: 'generic-58mm-escpos',
    manufacturer: 'Generic',
    model: 'Generic 58mm ESC/POS',
    paperWidthMm: 58,
    supportedConnections: ['USB_ESC_POS'],
    cutter: false,
    cashDrawer: false,
    encoding: 'PC437',
    status: 'UNVERIFIED',
    notes: 'Common portable format. Limited column width — template config must account for this.',
  },
];

export function findCertifiedModel(id: string): CertifiedPrinterModel | undefined {
  return CERTIFIED_PRINTER_MODELS.find((m) => m.id === id);
}
