import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import '../i18n';
import { EMPTY_PRESENTATION, ItemPresentationFields, MAX_TAGS, MAX_TAG_LENGTH, addTag, cleanTag, samePresentation } from './ItemPresentationFields';
import type { ItemPresentation } from './types';

describe('tag helpers', () => {
  it('cleans, dedupes case-insensitively and caps the list', () => {
    expect(cleanTag('  Chef   special ')).toBe('Chef special');
    expect(cleanTag('x'.repeat(40))).toHaveLength(MAX_TAG_LENGTH);
    expect(addTag(['Vegan'], 'vegan')).toEqual(['Vegan']);
    expect(addTag(['a'], '   ')).toEqual(['a']);
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    expect(addTag(full, 'extra')).toEqual(full);
    expect(addTag(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('compares presentations', () => {
    expect(samePresentation(EMPTY_PRESENTATION, { dietType: null, menuTags: [], spiceLevel: null })).toBe(true);
    expect(samePresentation(EMPTY_PRESENTATION, { ...EMPTY_PRESENTATION, spiceLevel: 0 })).toBe(false);
    expect(samePresentation({ ...EMPTY_PRESENTATION, menuTags: ['a'] }, { ...EMPTY_PRESENTATION, menuTags: ['b'] })).toBe(false);
  });
});

function Harness({ onValue }: { onValue: (v: ItemPresentation) => void }) {
  const [v, setV] = useState<ItemPresentation>(EMPTY_PRESENTATION);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <ItemPresentationFields
        value={v}
        onChange={(n) => {
          setV(n);
          onValue(n);
        }}
      />
    </form>
  );
}

describe('ItemPresentationFields', () => {
  it('sets dietary mark and spice level', () => {
    let last = EMPTY_PRESENTATION;
    render(<Harness onValue={(v) => (last = v)} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Non-veg/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Hot/ }));
    expect(last).toMatchObject({ dietType: 'NONVEG', spiceLevel: 3 });
    fireEvent.click(screen.getByRole('radio', { name: /No spice/ }));
    expect(last.spiceLevel).toBe(0);
    fireEvent.click(screen.getAllByRole('radio', { name: /Not set/ })[0]);
    expect(last.dietType).toBeNull();
  });
  it('adds tags with Enter (without submitting the form), from suggestions, and removes them', () => {
    let last = EMPTY_PRESENTATION;
    render(<Harness onValue={(v) => (last = v)} />);
    const input = screen.getByLabelText('Tags');
    fireEvent.change(input, { target: { value: 'Smoky' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(last.menuTags).toEqual(['Smoky']);
    fireEvent.click(screen.getByRole('button', { name: '+ Bestseller' }));
    expect(last.menuTags).toEqual(['Smoky', 'Bestseller']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag Smoky' }));
    expect(last.menuTags).toEqual(['Bestseller']);
    expect(screen.queryByRole('button', { name: '+ Bestseller' })).toBeNull();
  });
  it('stops at six tags', () => {
    let last = EMPTY_PRESENTATION;
    render(<Harness onValue={(v) => (last = v)} />);
    const input = screen.getByLabelText('Tags');
    for (const t of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      fireEvent.change(input, { target: { value: t } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    expect(last.menuTags).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect((input as HTMLInputElement).disabled).toBe(true);
  });
});
