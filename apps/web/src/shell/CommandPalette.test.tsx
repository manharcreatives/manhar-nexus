import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { CommandPalette, type Command } from './CommandPalette';

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __patched?: boolean };
  if (proto.__patched) return;
  proto.__patched = true;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(cleanup);

const commands: Command[] = [{ id: 'go', label: 'Go to Tables', group: 'pages', icon: null, run: () => undefined }];
const down = (el: Element) => fireEvent.pointerDown(el, { button: 0, pointerType: 'mouse' });
const up = (el: Element) => fireEvent.pointerUp(el, { button: 0, pointerType: 'mouse' });
const click = (el: Element) => fireEvent.click(el, { button: 0, detail: 1 });

describe('CommandPalette backdrop', () => {
  it('stays open when text selected in the search box is released over the backdrop', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} commands={commands} />);
    const dlg = screen.getByRole('dialog', { hidden: true });
    down(screen.getByRole('combobox'));
    up(dlg);
    click(dlg);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a real backdrop click and on Escape', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} commands={commands} />);
    const dlg = screen.getByRole('dialog', { hidden: true });
    down(dlg);
    up(dlg);
    click(dlg);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent(dlg, new Event('close')); // native Escape
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
