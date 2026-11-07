import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearLastReference, recallLastReference, rememberLastReference } from './claim';
import { ResumeBanner } from './ResumeBanner';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('the "pick up where you left off" reference', () => {
  it('remembers only the code and the time, for 48 hours', () => {
    rememberLastReference('NX-7K2Q9M', 1_000);
    expect(recallLastReference(2_000)).toBe('NX-7K2Q9M');
    expect(recallLastReference(1_000 + 48 * 3_600_000 + 1)).toBeNull();
    const raw = window.localStorage.getItem('nx.lastref') ?? '';
    expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual(['c', 't']);
  });

  it('ignores a damaged or odd value', () => {
    window.localStorage.setItem('nx.lastref', '{"c":"<script>","t":1}');
    expect(recallLastReference(2)).toBeNull();
    window.localStorage.setItem('nx.lastref', 'not json');
    expect(recallLastReference(2)).toBeNull();
  });

  it('the banner shows the reference, leads to /pay/return and can be dismissed for good', () => {
    rememberLastReference('NX-7K2Q9M');
    render(<ResumeBanner />);
    expect(screen.getByText('Request NX-7K2Q9M received')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Check payment' }).getAttribute('href')).toBe('/pay/return?code=NX-7K2Q9M');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('resume-banner')).toBeNull();
    expect(recallLastReference()).toBeNull();
  });

  it('shows nothing when there is no recent reference', () => {
    render(<ResumeBanner />);
    expect(screen.queryByTestId('resume-banner')).toBeNull();
    clearLastReference();
  });
});
