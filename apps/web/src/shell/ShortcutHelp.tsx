import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { KeyCombo } from '../ui/Kbd';
import { modKeyLabel } from './shortcuts';

export interface GoShortcut {
  key: string;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  goShortcuts: GoShortcut[];
}

function Row({ keys, label, description, joiner }: { keys: string[]; label: string; description: string; joiner?: string }) {
  return (
    <li className="flex min-h-10 items-center justify-between gap-4 py-1.5">
      <span className="text-sm">{description}</span>
      <KeyCombo keys={keys} label={label} joiner={joiner} />
    </li>
  );
}

/** "?" dialog listing the shortcuts this user can actually use. */
export function ShortcutHelp({ open, onClose, goShortcuts }: Props) {
  const { t } = useTranslation();
  const mod = modKeyLabel();
  const then = t('shell.help.then');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('shell.help.title')}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('shell.help.close')}
        </Button>
      }
    >
      <p className="text-sm text-muted">{t('shell.help.note')}</p>
      <h3 className="mt-5 font-ui text-xs font-medium tracking-wider text-muted uppercase">{t('shell.help.general')}</h3>
      <ul className="mt-1 divide-y divide-line">
        <Row keys={[mod, 'K']} label={`${mod} K`} description={t('shell.help.palette')} />
        <Row keys={['/']} label="/" description={t('shell.help.paletteSlash')} />
        <Row keys={['?']} label="?" description={t('shell.help.help')} />
        <Row keys={['Esc']} label="Esc" description={t('shell.help.escape')} />
      </ul>
      {goShortcuts.length > 0 && (
        <>
          <h3 className="mt-5 font-ui text-xs font-medium tracking-wider text-muted uppercase">{t('shell.help.navigation')}</h3>
          <ul className="mt-1 divide-y divide-line">
            {goShortcuts.map((s) => (
              <Row
                key={s.key}
                keys={['G', s.key.toUpperCase()]}
                joiner={then}
                label={`G ${then} ${s.key.toUpperCase()}`}
                description={t('shell.help.goTo', { page: s.label })}
              />
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
