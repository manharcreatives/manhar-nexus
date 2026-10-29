import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerFigure } from './LedgerFigure';

describe('LedgerFigure countUp', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }));
  afterEach(() => vi.useRealTimers());

  it('keeps the final amount for screen readers and settles on it', () => {
    const { container } = render(<LedgerFigure minor={123450} countUp />);
    expect(container.querySelector('.sr-only')?.textContent).toBe('₹1,234.50');
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(container.querySelector('[data-part="whole"]')?.textContent).toBe('1,234');
    expect(container.querySelector('[data-part="frac"]')?.textContent).toBe('.50');
  });

  it('renders the value at once without countUp', () => {
    const { container } = render(<LedgerFigure minor={500} />);
    expect(container.querySelector('[data-part="whole"]')?.textContent).toBe('5');
  });
});
