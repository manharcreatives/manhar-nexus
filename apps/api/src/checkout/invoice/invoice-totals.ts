export interface TaxBreakdownEntry {
  name: string;
  rate: number;
  taxableAmountMinorUnits: number;
  taxAmountMinorUnits: number;
}

export interface InvoiceLineData {
  serviceRequestLineId: string;
  itemNameSnapshot: string;
  variantNameSnapshot?: string;
  modifiersSummary?: string;
  quantity: number;
  unitPriceMinorUnits: number;
  modifiersMinorUnits: number;
  taxRateSnapshot: number;
  taxCategoryName?: string;
  lineSubtotalMinorUnits: number;
  lineTaxMinorUnits: number;
  lineTotalMinorUnits: number;
}

export interface InvoiceTotals {
  subtotalMinorUnits: number;
  totalTaxMinorUnits: number;
  grandTotalMinorUnits: number;
  taxBreakdown: TaxBreakdownEntry[];
  lines: InvoiceLineData[];
}

export interface BillableLineInput {
  id: string;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  unitPriceMinorUnits: number;
  taxRateSnapshot: { toNumber(): number };
  taxCategoryNameSnapshot: string | null;
  modifiers: Array<{ optionNameSnapshot: string; priceAdjMinorUnits: number }>;
}

/**
 * Turns billable service-request lines into invoice totals and invoice-line
 * snapshots. Shared by invoice creation and the live session bill preview so
 * both use exactly the same tax and rounding rules.
 */
export function computeInvoiceTotals(lines: BillableLineInput[]): InvoiceTotals {
  let subtotal = 0;
  let totalTax = 0;
  const taxGroups = new Map<string, TaxBreakdownEntry>();
  const invoiceLines: InvoiceLineData[] = [];

  for (const line of lines) {
    const modifiersSum = line.modifiers.reduce((s, m) => s + m.priceAdjMinorUnits, 0);
    // The order line's unit price already includes variant and modifier
    // adjustments (OrderService.resolveLineSnapshots); modifiersSum is kept
    // on the invoice line for display only and must not be added again.
    const lineSubtotal = line.unitPriceMinorUnits * line.quantity;
    const taxRate = line.taxRateSnapshot.toNumber();
    const lineTax = Math.round(lineSubtotal * taxRate);
    const lineTotal = lineSubtotal + lineTax;

    subtotal += lineSubtotal;
    totalTax += lineTax;

    const taxName = line.taxCategoryNameSnapshot ?? 'No Tax';
    const taxKey = `${taxName}:${taxRate}`;
    const grp = taxGroups.get(taxKey);
    if (grp) {
      grp.taxableAmountMinorUnits += lineSubtotal;
      grp.taxAmountMinorUnits += lineTax;
    } else {
      taxGroups.set(taxKey, {
        name: taxName,
        rate: taxRate,
        taxableAmountMinorUnits: lineSubtotal,
        taxAmountMinorUnits: lineTax,
      });
    }

    invoiceLines.push({
      serviceRequestLineId: line.id,
      itemNameSnapshot: line.itemNameSnapshot,
      variantNameSnapshot: line.variantNameSnapshot ?? undefined,
      modifiersSummary: line.modifiers.length > 0 ? line.modifiers.map((m) => m.optionNameSnapshot).join(', ') : undefined,
      quantity: line.quantity,
      unitPriceMinorUnits: line.unitPriceMinorUnits,
      modifiersMinorUnits: modifiersSum,
      taxRateSnapshot: taxRate,
      taxCategoryName: line.taxCategoryNameSnapshot ?? undefined,
      lineSubtotalMinorUnits: lineSubtotal,
      lineTaxMinorUnits: lineTax,
      lineTotalMinorUnits: lineTotal,
    });
  }

  return {
    subtotalMinorUnits: subtotal,
    totalTaxMinorUnits: totalTax,
    grandTotalMinorUnits: subtotal + totalTax,
    taxBreakdown: Array.from(taxGroups.values()),
    lines: invoiceLines,
  };
}
