import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@nexus/shared';
import type { AuthUser } from '../auth/AuthContext';
import { cn } from '../lib/cn';
import * as Icons from '../ui/icons';
import { Kbd } from '../ui/Kbd';
import { EnvBadge } from './EnvBadge';
import { initialsOf } from './identity';
import { modKeyLabel } from './shortcuts';
import { useDismiss } from './useDismiss';

interface Props {
  user: AuthUser;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  onChangePassword: () => void;
  onSignOut: () => void;
}

interface Item {
  id: string;
  label: string;
  icon: ReactNode;
  hint?: ReactNode;
  run: () => void;
  tone?: 'bad';
}

/** Initials button → identity, roles, version, shortcut help and Sign out (WAI-ARIA menu button). */
export function UserMenu({ user, onOpenPalette, onOpenShortcuts, onChangePassword, onSignOut }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const uid = useId();
  const menuId = `${uid}-menu`;

  useDismiss(open, [wrapRef], () => setOpen(false));

  const isPlatform = user.realm === 'PLATFORM';
  const roleNames = user.roles.map((r) => r.name).filter(Boolean);
  const name = user.displayName || user.email;

  const items: Item[] = [
    {
      id: 'palette',
      label: t('shell.search'),
      icon: <Icons.Search className="size-4" aria-hidden />,
      hint: (
        <span className="flex gap-1" aria-hidden>
          <Kbd>{modKeyLabel()}</Kbd>
          <Kbd>K</Kbd>
        </span>
      ),
      run: onOpenPalette,
    },
    {
      id: 'shortcuts',
      label: t('shell.help.title'),
      icon: <Icons.Keyboard className="size-4" aria-hidden />,
      hint: (
        <span aria-hidden>
          <Kbd>?</Kbd>
        </span>
      ),
      run: onOpenShortcuts,
    },
    {
      id: 'password',
      label: t('account.password.menu'),
      icon: <Icons.KeyRound className="size-4" aria-hidden />,
      run: onChangePassword,
    },
    {
      id: 'signout',
      label: t('shell.signOut'),
      icon: <Icons.LogOut className="size-4" aria-hidden />,
      run: onSignOut,
      tone: 'bad',
    },
  ];

  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  const openAt = (index: number) => {
    setFocusIndex(index);
    setOpen(true);
  };
  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openAt(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openAt(items.length - 1);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = items.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((i) => (i >= last ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((i) => (i <= 0 ? last : i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusIndex(last);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('shell.userMenuFor', { name })}
        onClick={() => (open ? setOpen(false) : openAt(0))}
        onKeyDown={onButtonKey}
        className="grid size-11 place-items-center rounded-full transition-colors duration-(--duration-micro) hover:bg-sunken"
      >
        {/* Initials come from CSS so they are not "visible label text" the accessible name must repeat (WCAG 2.5.3). */}
        <span
          aria-hidden
          data-initials={initialsOf(user.displayName, user.email)}
          className={cn(
            'grid size-8 place-items-center rounded-full text-xs font-semibold tracking-wide before:content-[attr(data-initials)]',
            isPlatform ? 'bg-accent text-[#04120a]' : 'bg-accent-soft text-accent-strong',
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            'z-50 nx-pop overflow-hidden rounded-panel',
            'max-sm:fixed max-sm:inset-x-4 max-sm:top-15 sm:absolute sm:top-full sm:right-0 sm:mt-1.5 sm:w-72',
          )}
        >
          <div className="border-b border-line px-4 py-3.5">
            <p className="truncate font-display text-base font-semibold">{name}</p>
            {user.displayName && <p className="truncate text-sm text-muted">{user.email}</p>}
            <p className="mt-2 flex flex-wrap gap-1.5">
              {isPlatform && (
                <span className="rounded-control bg-accent px-2 py-0.5 text-xs font-semibold text-[#04120a]">
                  {t('shell.platformRealm')}
                </span>
              )}
              {roleNames.length > 0 ? (
                roleNames.map((r) => (
                  <span key={r} className="rounded-control bg-sunken px-2 py-0.5 text-xs font-medium text-ink">
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted">{t('shell.noRoles')}</span>
              )}
            </p>
          </div>
          <div id={menuId} role="menu" aria-label={t('shell.userMenu')} onKeyDown={onMenuKey} className="p-1.5">
            {items.map((item, i) => (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => {
                  close(item.id !== 'signout');
                  item.run();
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-control px-2.5 text-left text-sm transition-colors duration-(--duration-micro)',
                  'hover:bg-sunken focus-visible:bg-sunken',
                  item.tone === 'bad' ? 'text-bad' : 'text-ink',
                  item.id === 'signout' && 'mt-1 border-t border-line',
                )}
              >
                <span className={item.tone === 'bad' ? 'text-bad' : 'text-muted'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.hint}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-xs text-muted">
            <span className="tabular">{t('shell.version', { version: APP_VERSION })}</span>
            <EnvBadge />
          </div>
        </div>
      )}
    </div>
  );
}
