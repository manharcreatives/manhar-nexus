import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { claimMessage, claimUrl, issueClaimLink, whatsappUrl, type ClaimLink, type RegistrationRequest } from './api';

/**
 * Staff tools for an account that now exists: make the owner's one-time set-password link and copy it or send it on
 * WhatsApp. One link is made per visit and reused by both buttons, because making a new one cancels the old one.
 * The link is never shown on screen or logged; it only goes to the clipboard or into the WhatsApp message.
 */
export function ClaimLinkButtons({ request }: { request: Pick<RegistrationRequest, 'id' | 'contactName' | 'restaurantName' | 'phone'> }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<ClaimLink | null>(null);

  async function ensureLink(): Promise<string | null> {
    if (link && Date.parse(link.expiresAt) > Date.now() + 60_000) return claimUrl(link.token);
    setBusy(true);
    try {
      const fresh = await issueClaimLink(request.id);
      setLink(fresh);
      return claimUrl(fresh.token);
    } catch {
      toast.show(t('registrations.claim.failed'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const url = await ensureLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.show(t('registrations.claim.copied'));
    } catch {
      toast.show(t('registrations.claim.failed'));
    }
  }

  async function whatsapp() {
    const url = await ensureLink();
    if (!url) return;
    window.open(whatsappUrl(request.phone, claimMessage(request, url)), '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <Button variant="secondary" loading={busy} onClick={() => void copy()}>
        {t('registrations.claim.copy')}
      </Button>
      <Button variant="secondary" loading={busy} onClick={() => void whatsapp()}>
        {t('registrations.claim.whatsapp')}
      </Button>
    </>
  );
}
