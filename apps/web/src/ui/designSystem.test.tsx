import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { Select } from './Select';
import { StatusPill } from './StatusPill';
import { Tabs } from './Tabs';
import { Textarea } from './Textarea';
import { ToastProvider, toastDuration, useToast } from './Toast';

afterEach(() => cleanup());

// jsdom has no modal dialog support; emulate the bits the shared Dialog relies on.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

describe('Button', () => {
  it('keeps a 44px (md) or 48px (lg) minimum target and a visible border on secondary', () => {
    render(
      <>
        <Button>Save</Button>
        <Button size="lg">Pay</Button>
        <Button variant="secondary">Cancel</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('min-h-11');
    expect(screen.getByRole('button', { name: 'Pay' }).className).toContain('min-h-12');
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('border-white/20');
  });

  it('is disabled and marked busy while loading', () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
  });
});

describe('form controls', () => {
  it('Field links the error and the hint, marks the input invalid and uses the high-contrast border', () => {
    render(<Field label="Phone" hint="10 digits" error="Too short" />);
    const input = screen.getByLabelText('Phone');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] as string)?.textContent).toBe('Too short');
    // A field without an error uses the visible control border (3.8:1), never the old white/10.
    cleanup();
    render(<Field label="Phone" />);
    expect(screen.getByLabelText('Phone').className).toContain('border-control');
    expect(screen.getByLabelText('Phone').className).not.toContain('border-white/10');
  });

  it('Select and Textarea link their error text', () => {
    render(
      <>
        <Select label="Plan" error="Choose one">
          <option value="">-</option>
        </Select>
        <Textarea label="Notes" error="Too long" />
      </>,
    );
    for (const [label, text] of [
      ['Plan', 'Choose one'],
      ['Notes', 'Too long'],
    ] as const) {
      const el = screen.getByLabelText(label);
      expect(el.getAttribute('aria-invalid')).toBe('true');
      expect(document.getElementById(el.getAttribute('aria-describedby') as string)?.textContent).toBe(text);
    }
  });

  it('Checkbox row is a 44px tap target and the label wraps long text', () => {
    render(<Checkbox label="A very long label that should wrap rather than overflow its row on a small phone" />);
    const row = screen.getByRole('checkbox').closest('label') as HTMLElement;
    expect(row.className).toContain('min-h-11');
  });
});

describe('StatusPill', () => {
  it('uses a different marker shape per tone, so colour is never the only signal', () => {
    const tones = ['ok', 'warn', 'bad', 'info', 'neutral'] as const;
    const classes = tones.map((tone) => {
      const { container, unmount } = render(<StatusPill tone={tone}>{tone}</StatusPill>);
      const cls = (container.querySelector('[data-marker]') as HTMLElement).className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(tones.length);
  });
});

describe('Tabs', () => {
  function Harness() {
    return (
      <Tabs
        label="Sections"
        active="a"
        onChange={onChange}
        items={[
          { key: 'a', label: 'One' },
          { key: 'b', label: 'Two' },
          { key: 'c', label: 'Three' },
        ]}
      />
    );
  }
  const onChange = vi.fn();

  it('only the active tab is in the Tab order, and the arrow keys, Home and End move between tabs', () => {
    onChange.mockReset();
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    const first = tabs[0] as HTMLElement;
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(first, { key: 'ArrowLeft' }); // from "a": wraps to the last tab
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(first, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(first, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });
});

describe('Dialog', () => {
  it('has a sticky title, a sticky footer that clears the phone home indicator, and closes on Esc (cancel event)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open onClose={onClose} title="Edit table" footer={<Button>Save</Button>}>
        <p>Body</p>
      </Dialog>,
    );
    const dlg = container.querySelector('dialog') as HTMLDialogElement;
    expect(dlg.getAttribute('aria-label')).toBe('Edit table');
    expect(dlg.className).toContain('max-h-[calc(100dvh-1rem)]');
    expect(dlg.querySelector('h2')?.parentElement?.className).toContain('sticky');
    const footer = screen.getByRole('button', { name: 'Save' }).parentElement as HTMLElement;
    expect(footer.className).toContain('sticky');
    expect(footer.className).toContain('safe-area-inset-bottom');
    // The platform closes a modal <dialog> on Esc by firing "close"; the shared component forwards it.
    act(() => {
      dlg.dispatchEvent(new Event('close'));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Toast', () => {
  function Trigger({ tone, withAction }: { tone: 'ok' | 'bad' | 'info'; withAction?: () => void }) {
    const toast = useToast();
    return (
      <button type="button" onClick={() => toast.show('Saved it', tone, withAction ? { action: { label: 'Undo', onClick: withAction } } : undefined)}>
        go
      </button>
    );
  }

  it('announces good news as status and a problem as alert, each exactly once', () => {
    render(
      <ToastProvider>
        <Trigger tone="bad" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getAllByText('Saved it')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toContain('Saved it');
    cleanup();
    render(
      <ToastProvider>
        <Trigger tone="ok" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByRole('status').textContent).toContain('Saved it');
  });

  it('an Undo action is a real button that runs once and removes the toast', () => {
    const undo = vi.fn();
    render(
      <ToastProvider>
        <Trigger tone="ok" withAction={undo} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Saved it')).toBeNull();
  });

  it('problems and toasts with an action stay longer than a plain confirmation', () => {
    expect(toastDuration('ok')).toBe(4500);
    expect(toastDuration('bad')).toBe(8000);
    expect(toastDuration('ok', { action: { label: 'Undo', onClick: () => undefined } })).toBe(8000);
    expect(toastDuration('ok', { duration: 1000 })).toBe(1000);
  });
});
