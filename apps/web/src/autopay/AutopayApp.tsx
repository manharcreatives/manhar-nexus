import { useEffect, useState } from 'react';
import { autopayToken } from './path';

/** Same base the staff app uses. Duplicated on purpose: the owner's page must not import the auth code. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

type Answer =
  | { state: 'ready'; sessionId: string; environment: 'sandbox' | 'production'; restaurantName: string; planName: string; amountPaise: number }
  | { state: 'authorised' | 'closed' };

type View = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'answer'; answer: Answer };

interface CashfreeSdk {
  subscriptionsCheckout: (opts: { subscriptionsSessionId: string; redirectTarget: '_self' }) => Promise<unknown>;
}
declare global {
  interface Window {
    Cashfree?: (opts: { mode: 'sandbox' | 'production' }) => CashfreeSdk;
  }
}

export const rupees = (paise: number): string => (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(paise / 100) ? 0 : 2, maximumFractionDigits: 2 });

function loadSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SDK_URL;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('sdk'));
    document.head.appendChild(el);
  });
}

/**
 * The owner's page to approve the monthly UPI AutoPay mandate (/pay/autopay/<token>). Rendered by App.tsx outside the
 * auth providers. The Cashfree JS SDK does the approval; this page only fetches the session and starts it.
 * NOT yet verified end to end in a browser against the sandbox (see docs/runbooks/cashfree.md).
 */
export default function AutopayApp() {
  const token = autopayToken(window.location.pathname);
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'UPI AutoPay';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow,noarchive';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  useEffect(() => {
    if (!token) {
      setView({ kind: 'answer', answer: { state: 'closed' } });
      return;
    }
    let live = true;
    fetch(`${API_BASE}/public/subscriptions/checkout/${encodeURIComponent(token)}`, { headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (res.status === 404) return { kind: 'answer', answer: { state: 'closed' } } as const;
        if (!res.ok) return { kind: 'error', message: 'We could not load this page. Please try again in a moment, or message us.' } as const;
        return { kind: 'answer', answer: (await res.json()) as Answer } as const;
      })
      .catch(() => ({ kind: 'error', message: 'No connection. Please check your internet and try again.' }) as const)
      .then((next) => {
        if (live) setView(next);
      });
    return () => {
      live = false;
    };
  }, [token]);

  async function start(answer: Extract<Answer, { state: 'ready' }>) {
    setStarting(true);
    setStartError(null);
    try {
      await loadSdk();
      if (!window.Cashfree) throw new Error('sdk');
      await window.Cashfree({ mode: answer.environment }).subscriptionsCheckout({ subscriptionsSessionId: answer.sessionId, redirectTarget: '_self' });
    } catch {
      setStartError('Could not open the approval screen. Please try again, or message us and we will help.');
      setStarting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px 16px', background: '#070a09', color: '#e8efe9', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ width: 'min(30rem, 100%)', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 24, lineHeight: 1.5 }}>
        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Manhar Nexus · UPI AutoPay</h1>
        {view.kind === 'loading' ? <p>Loading…</p> : null}
        {view.kind === 'error' ? <p role="alert">{view.message}</p> : null}
        {view.kind === 'answer' && view.answer.state === 'closed' ? <p>This link is no longer valid. Please message us and we will send a new one.</p> : null}
        {view.kind === 'answer' && view.answer.state === 'authorised' ? (
          <p>Thank you. Your UPI AutoPay is set up (or your bank is approving it). We will confirm on WhatsApp. You can cancel any time from your UPI app.</p>
        ) : null}
        {view.kind === 'answer' && view.answer.state === 'ready' ? (
          <>
            <p>
              {view.answer.restaurantName}: approve a monthly UPI AutoPay of <strong>₹{rupees(view.answer.amountPaise)}</strong> (GST included) for the {view.answer.planName} plan.
            </p>
            <ul style={{ paddingLeft: 18, fontSize: 14, opacity: 0.85 }}>
              <li>You approve once in your UPI app. A ₹1 test debit is refunded.</li>
              <li>Each month the same amount is debited; your bank or UPI app reminds you before every debit.</li>
              <li>You can cancel any time from your UPI app.</li>
            </ul>
            <button
              type="button"
              onClick={() => void start(view.answer as Extract<Answer, { state: 'ready' }>)}
              disabled={starting}
              style={{ minHeight: 48, width: '100%', borderRadius: 12, border: 0, background: '#35d07f', color: '#04110a', fontSize: 16, fontWeight: 600, cursor: starting ? 'wait' : 'pointer' }}
            >
              {starting ? 'Opening…' : 'Approve UPI AutoPay'}
            </button>
            {startError ? <p role="alert">{startError}</p> : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
