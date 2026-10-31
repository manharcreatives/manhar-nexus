import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import { useBackdropDismiss, useOutsideDismiss } from './useBackdropDismiss';

// jsdom has no modal dialog support; emulate the bits <Dialog> relies on.
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

/** Pointer helpers: a "gesture" is down + up on (possibly different) elements, then the browser's click. */
const down = (el: Element) => fireEvent.pointerDown(el, { button: 0, pointerType: 'mouse' });
const up = (el: Element) => fireEvent.pointerUp(el, { button: 0, pointerType: 'mouse' });
/** The click a browser dispatches after down/up: on the nearest common ancestor of the two targets. */
const click = (el: Element) => fireEvent.click(el, { button: 0, detail: 1 });

function DialogHarness({ onClose, closeOnBackdrop }: { onClose: () => void; closeOnBackdrop?: boolean }) {
  return (
    <Dialog open onClose={onClose} title="Edit table" closeOnBackdrop={closeOnBackdrop} footer={<button type="button">Save</button>}>
      <p>Table T4 note: please seat near the window</p>
      <input aria-label="Note" defaultValue="hello world" />
    </Dialog>
  );
}
const backdropOf = () => screen.getByRole('dialog', { hidden: true });

describe('Dialog backdrop dismissal (owner item A6: selecting text must not close the card)', () => {
  it('closes on a clean click of the backdrop (press AND release on it)', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const dlg = backdropOf();
    down(dlg);
    up(dlg);
    click(dlg);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when the press began inside the card and the release lands on the backdrop (text selection drag)', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const dlg = backdropOf();
    const text = screen.getByText(/please seat near the window/);
    down(text); // start selecting text inside the card
    up(dlg); // release over the backdrop
    click(dlg); // the browser reports the click on the common ancestor: the dialog/backdrop element
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT close when dragging inside an input and releasing outside the card', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const dlg = backdropOf();
    down(screen.getByLabelText('Note'));
    up(dlg);
    click(dlg);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT close when the press began on the backdrop and the release is inside the card', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const dlg = backdropOf();
    down(dlg);
    up(screen.getByText(/please seat near the window/));
    click(dlg);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT close on ordinary clicks inside the card', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const text = screen.getByText(/please seat near the window/);
    down(text);
    up(text);
    click(text);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('forgets an abandoned drag: the next real backdrop click still closes', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const dlg = backdropOf();
    down(screen.getByText(/please seat near the window/));
    up(dlg);
    click(dlg); // swallowed
    expect(onClose).not.toHaveBeenCalled();
    down(dlg);
    up(dlg);
    click(dlg);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keyboard / assistive-technology activation (a click with no pointer events) still closes', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    click(backdropOf());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape still closes (native cancel -> close event)', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    fireEvent(backdropOf(), new Event('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('explicit buttons are unaffected and keep working', () => {
    const onSave = vi.fn();
    render(
      <Dialog open onClose={() => undefined} title="Confirm" footer={<button type="button" onClick={onSave}>Save</button>}>
        body
      </Dialog>,
    );
    const save = screen.getByRole('button', { name: 'Save', hidden: true });
    down(save);
    up(save);
    click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('closeOnBackdrop={false} keeps the dialog open for a clean backdrop click', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} closeOnBackdrop={false} />);
    const dlg = backdropOf();
    down(dlg);
    up(dlg);
    click(dlg);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the dialog labelled and focusable (accessibility contract unchanged)', () => {
    render(<DialogHarness onClose={() => undefined} />);
    const dlg = backdropOf();
    expect(dlg.getAttribute('aria-label')).toBe('Edit table');
    expect(dlg.tabIndex).toBe(-1);
    expect(dlg.hasAttribute('open')).toBe(true);
  });
});

describe('useBackdropDismiss on a custom scrim that contains the card', () => {
  function Scrim({ onDismiss }: { onDismiss: () => void }) {
    const handlers = useBackdropDismiss(onDismiss);
    return (
      <div data-testid="scrim" {...handlers}>
        <section data-testid="card">
          <p>Selectable card text</p>
        </section>
      </div>
    );
  }

  it('closes only for a press and release on the scrim itself', () => {
    const onDismiss = vi.fn();
    render(<Scrim onDismiss={onDismiss} />);
    const scrim = screen.getByTestId('scrim');
    const card = screen.getByTestId('card');
    // drag from card text to scrim: stays open
    down(screen.getByText('Selectable card text'));
    up(scrim);
    click(scrim);
    // drag from scrim into the card: stays open
    down(scrim);
    up(card);
    click(scrim);
    // click in card: stays open
    down(card);
    up(card);
    click(card);
    expect(onDismiss).not.toHaveBeenCalled();
    down(scrim);
    up(scrim);
    click(scrim);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses the latest onDismiss without re-creating handlers', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Scrim onDismiss={first} />);
    const before = screen.getByTestId('scrim');
    rerender(<Scrim onDismiss={second} />);
    expect(screen.getByTestId('scrim')).toBe(before);
    click(before);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('useOutsideDismiss (popovers and menus)', () => {
  function Popover({ onDismiss }: { onDismiss: () => void }) {
    const [open, setOpen] = useState(true);
    const ref = useRef<HTMLDivElement>(null);
    useOutsideDismiss(open, [ref], () => {
      setOpen(false);
      onDismiss();
    });
    return (
      <div>
        <p data-testid="outside">elsewhere</p>
        {open && (
          <div ref={ref} data-testid="popover">
            <span>Popover text</span>
          </div>
        )}
      </div>
    );
  }

  it('a press inside that ends outside (text selection) keeps the popover open', () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);
    down(screen.getByText('Popover text'));
    up(screen.getByTestId('outside'));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByTestId('popover')).toBeTruthy();
  });

  it('a press that starts outside dismisses it', () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);
    down(screen.getByTestId('outside'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('popover')).toBeNull();
  });
});
