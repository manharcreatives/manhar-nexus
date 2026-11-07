import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { StatusPill } from '../ui/StatusPill';
import { useToast } from '../ui/Toast';
import { claimUrl, whatsappUrl } from '../registrations/api';
import { createResetLink, listClientUsers, type ClientUser } from './api';
import { formatDateTime } from './helpers';

/**
 * Who can sign in for this client, when they last did, whether they are locked out, and a safe way to help someone
 * who forgot their password: a one-time link (shown only as Copy / WhatsApp, never on screen).
 */
export function PeopleBlock({ businessId, ownerPhone }: { businessId: string; ownerPhone?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [users, setUsers] = useState<ClientUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<ClientUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ user: ClientUser; url: string } | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setUsers(await listClientUsers(businessId));
    } catch {
      setFailed(true);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function makeLink(user: ClientUser) {
    setBusy(true);
    try {
      const link = await createResetLink(businessId, user.id);
      setConfirming(null);
      setReady({ user, url: claimUrl(link.token) });
      void load();
    } catch {
      toast.show(t('commercial.people.failedLink'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.show(t('commercial.people.copied'));
    } catch {
      toast.show(t('commercial.people.failedLink'));
    }
  }

  return (
    <section aria-labelledby="people-h" className="space-y-3">
      <h3 id="people-h" className="text-lg font-semibold">
        {t('commercial.people.title')}
      </h3>
      {failed ? (
        <p className="text-sm text-bad">{t('commercial.people.loadFailed')}</p>
      ) : users === null ? null : users.length === 0 ? (
        <p className="text-sm text-muted">{t('commercial.people.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const locked = u.lockedUntil && Date.parse(u.lockedUntil) > Date.now();
            return (
              <li key={u.id} className="nx-glass flex flex-wrap items-center justify-between gap-3 rounded-panel px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.name} <span className="font-normal text-muted">· {u.roles.join(', ')}</span>
                  </p>
                  <p className="break-all text-muted">{u.email}</p>
                  <p className="text-xs text-muted">
                    {u.lastLoginAt ? `${t('commercial.people.lastLogin')}: ${formatDateTime(u.lastLoginAt)}` : t('commercial.people.never')}
                    {u.failedLoginCount ? ` · ${t('commercial.people.failed', { count: u.failedLoginCount })}` : ''}
                    {locked && u.lockedUntil ? ` · ${t('commercial.people.locked', { date: formatDateTime(u.lockedUntil) })}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={u.status === 'ACTIVE' ? 'ok' : 'neutral'}>{u.status}</StatusPill>
                  <Button variant="secondary" onClick={() => setConfirming(u)}>
                    {t('commercial.people.reset')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirming ? (
        <Dialog
          open
          onClose={() => !busy && setConfirming(null)}
          title={t('commercial.people.confirmTitle', { name: confirming.name })}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(null)} disabled={busy} data-autofocus>
                {t('onboarding.cancel')}
              </Button>
              <Button loading={busy} onClick={() => void makeLink(confirming)}>
                {t('commercial.people.confirm')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">{t('commercial.people.confirmBody', { name: confirming.name })}</p>
        </Dialog>
      ) : null}

      {ready ? (
        <Dialog open onClose={() => setReady(null)} title={t('commercial.people.confirmTitle', { name: ready.user.name })} footer={<Button onClick={() => setReady(null)}>{t('provision.done')}</Button>}>
          <div className="space-y-3">
            <p className="text-sm text-muted">{t('commercial.people.ready')}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void copy(ready.url)}>
                {t('commercial.people.copy')}
              </Button>
              {ownerPhone ? (
                <a
                  className="inline-flex min-h-11 items-center rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40"
                  href={whatsappUrl(ownerPhone, t('commercial.people.message', { name: ready.user.name, url: ready.url }))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('commercial.people.whatsapp')}
                </a>
              ) : null}
            </div>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
