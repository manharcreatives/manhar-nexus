import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../i18n';
import { BarTrend } from './BarTrend';
import { ShareBar } from './ShareBar';

const data = ['Mon', 'Tue', 'Wed'].map((d, i) => ({ key: `k${i}`, label: d, fullLabel: `${d} full`, value: (i + 1) * 100 }));

function renderTrend() {
  return render(
    <BarTrend
      data={data}
      title="Revenue per day"
      valueLabel="Net revenue"
      unit="INR"
      categoryLabel="Day"
      formatValue={(v) => `Rs ${v}`}
      formatTick={(v) => String(v)}
      highlightKey="k2"
    />,
  );
}

describe('BarTrend', () => {
  it('exposes each bar with its exact value and a single tab stop on the latest bar', () => {
    renderTrend();
    const bars = screen.getAllByRole('img');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual(['Mon full: Rs 100', 'Tue full: Rs 200', 'Wed full: Rs 300']);
    expect(bars.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
    expect(screen.getByRole('group', { name: 'Revenue per day' })).toBeTruthy();
  });

  it('moves focus with arrow keys and shows the exact value on focus', () => {
    renderTrend();
    const bars = screen.getAllByRole('img');
    act(() => bars[2].focus());
    fireEvent.keyDown(bars[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(bars[1]);
    expect(screen.getAllByText('Rs 200').length).toBeGreaterThan(0);
    fireEvent.keyDown(bars[1], { key: 'Home' });
    expect(document.activeElement).toBe(bars[0]);
  });

  it('offers a table with the same numbers', () => {
    renderTrend();
    expect(screen.getByText('Show as table')).toBeTruthy();
    expect(screen.getByRole('table', { hidden: true })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Rs 300', hidden: true })).toBeTruthy();
  });
});

describe('ShareBar', () => {
  it('folds beyond three categories into Other and labels every share', () => {
    render(
      <ShareBar
        title="Payments"
        formatValue={(v) => `Rs ${v}`}
        segments={[
          { key: 'a', label: 'Cash', value: 50 },
          { key: 'b', label: 'UPI', value: 30 },
          { key: 'c', label: 'Card', value: 10 },
          { key: 'd', label: 'Wallet', value: 6 },
          { key: 'e', label: 'Cheque', value: 4 },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Cash50%Rs 50', 'UPI30%Rs 30', 'Card10%Rs 10', 'Other10%Rs 10']);
  });
});
