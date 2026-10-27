import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useWorkLocation } from '../context/LocationContext';
import { brand } from '../lib/brand';
import { Wordmark } from '../brand/Wordmark';
import { cn } from '../lib/cn';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import { ConnectionIndicator } from '../realtime/LiveBadge';
import { PageHeader } from '../ui/PageHeader';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { KeyCombo, Kbd } from '../ui/Kbd';
import * as Icons from '../ui/icons';
import { computeAccess } from './access';
import { CommandPalette, type Command } from './CommandPalette';
import { ContextSwitcher } from './ContextSwitcher';
import { EnvBadge } from './EnvBadge';
import { PAGES, PAGE_GROUPS } from './pages';
import { ShortcutHelp } from './ShortcutHelp';
import { modKeyLabel, type ShortcutBinding } from './shortcuts';
import { UserMenu } from './UserMenu';
import { useGlobalShortcuts } from './useGlobalShortcuts';

function BrandMark() {
  return (
    <NavLink to="/" className="flex min-h-11 shrink-0 items-center rounded-control pr-1" aria-label={brand.name}>
      <Wordmark nameClassName="hidden md:inline" />
    </NavLink>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const work = useWorkLocation();
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [location.pathname]);

  const access = useMemo(() => computeAccess(user), [user]);
  const visiblePages = useMemo(() => PAGES.filter((p) => p.can(access)), [access]);

  const openPalette = useCallback(() => {
    setNavOpen(false);
    setPaletteOpen(true);
  }, []);
  const doSignOut = useCallback(() => void signOut(), [signOut]);

  // ── Shortcuts (derived from the same page list) ──
  const bindings = useMemo<ShortcutBinding[]>(
    () => [
      { id: 'palette', sequence: ['mod+k'], allowWhileTyping: true },
      { id: 'palette', sequence: ['/'] },
      { id: 'help', sequence: ['?'] },
      ...visiblePages.filter((p) => p.goKey).map((p) => ({ id: `go:${p.path}`, sequence: ['g', p.goKey as string] })),
    ],
    [visiblePages],
  );
  useGlobalShortcuts(bindings, (id) => {
    if (id === 'palette') openPalette();
    else if (id === 'help') setHelpOpen(true);
    else if (id.startsWith('go:')) navigate(id.slice(3));
  });

  // ── Command palette entries: every visible page, locations, actions ──
  const commands = useMemo<Command[]>(() => {
    const pageCommands: Command[] = visiblePages.map((p) => {
      const Icon = p.icon;
      return {
        id: `page:${p.path}`,
        label: t(p.labelKey),
        keywords: p.keywordsKey ? t(p.keywordsKey) : undefined,
        group: 'pages',
        icon: <Icon className="size-4" />,
        current: p.path === '/' ? location.pathname === '/' : location.pathname.startsWith(p.path),
        hint: p.goKey ? <KeyCombo keys={['G', p.goKey.toUpperCase()]} /> : undefined,
        run: () => navigate(p.path),
      };
    });
    const locationCommands: Command[] = work.canChoose
      ? [
          { id: null, name: t('shell.allLocations') },
          ...work.locations.map((l) => ({ id: l.id as string | null, name: l.name })),
        ].map((l) => ({
          id: `location:${l.id ?? 'all'}`,
          label: t('shell.palette.switchTo', { name: l.name }),
          keywords: `${t('shell.keywords.location')} ${l.name}`,
          group: 'locations' as const,
          icon: <Icons.MapPin className="size-4" />,
          current: work.locationId === l.id,
          run: () => work.setLocationId(l.id),
        }))
      : [];
    const actionCommands: Command[] = [
      {
        id: 'action:shortcuts',
        label: t('shell.help.title'),
        keywords: t('shell.keywords.shortcuts'),
        group: 'actions',
        icon: <Icons.Keyboard className="size-4" />,
        hint: <Kbd>?</Kbd>,
        run: () => setHelpOpen(true),
      },
      {
        id: 'action:signout',
        label: t('shell.signOut'),
        keywords: t('shell.keywords.signOut'),
        group: 'actions',
        icon: <Icons.LogOut className="size-4" />,
        run: doSignOut,
      },
    ];
    return [...pageCommands, ...locationCommands, ...actionCommands];
  }, [visiblePages, work, location.pathname, navigate, doSignOut, t]);

  const goShortcuts = visiblePages.filter((p) => p.goKey).map((p) => ({ key: p.goKey as string, label: t(p.labelKey) }));

  const nav = (
    <nav aria-label={t('shell.primaryNav')} className="space-y-5">
      {PAGE_GROUPS.map(({ id, headingKey }) => {
        const items = visiblePages.filter((p) => p.group === id);
        if (items.length === 0) return null;
        return (
          <div key={id}>
            {headingKey && (
              <p className="eyebrow mb-1.5 px-3">{t(headingKey)}</p>
            )}
            <ul className="space-y-0.5">
              {items.map(({ path, labelKey, icon: Icon }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    end={path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-(--duration-micro)',
                        'before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:transition-colors',
                        isActive
                          ? 'bg-sunken/70 text-ink before:bg-accent [&_svg]:text-accent'
                          : 'text-ink/80 before:bg-transparent hover:bg-sunken/45 hover:text-ink [&_svg]:text-muted',
                      )
                    }
                  >
                    <Icon className="size-[1.125rem]" />
                    {t(labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const mod = modKeyLabel();

  return (
    <div className="flex h-screen w-full flex-col bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('shell.skipToContent')}
      </a>
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface px-2 sm:gap-2 sm:px-4">
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-control hover:bg-sunken lg:hidden"
          aria-label={t('shell.openNav')}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? <Icons.X className="size-5" /> : <Icons.Menu className="size-5" />}
        </button>
        <BrandMark />
        <span aria-hidden className="mx-1 hidden h-6 w-px shrink-0 bg-line sm:block" />
        <div className="min-w-0 flex-1">
          <ContextSwitcher isPlatform={access.isPlatform} />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={openPalette}
            aria-keyshortcuts="Control+K Meta+K /"
            className={cn(
              'grid size-11 place-items-center rounded-control text-muted transition-colors duration-(--duration-micro) hover:bg-sunken hover:text-ink',
              'lg:flex lg:h-10 lg:w-60 lg:items-center lg:justify-between lg:gap-2 lg:border lg:border-line lg:bg-paper lg:px-3 lg:text-sm',
            )}
          >
            <span className="flex items-center gap-2">
              <Icons.Search className="size-[1.125rem] lg:size-4" aria-hidden />
              <span className="sr-only lg:not-sr-only">{t('shell.search')}</span>
            </span>
            <span className="hidden items-center gap-1 lg:inline-flex" aria-hidden>
              <Kbd>{mod}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <span className="hidden sm:inline-flex"><EnvBadge /></span>
          {!access.isPlatform && <ConnectionIndicator />}
          {!access.isPlatform && <NotificationsPanel />}
          {user && (
            <UserMenu user={user} onOpenPalette={openPalette} onOpenShortcuts={() => setHelpOpen(true)} onSignOut={doSignOut} />
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={cn(
            'z-30 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface p-4',
            'max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:transition-[transform,visibility] max-lg:duration-(--duration-surface)',
            navOpen ? 'max-lg:translate-x-0' : 'max-lg:invisible max-lg:-translate-x-full',
          )}
        >
          {nav}
          <p className="mt-auto hidden items-center gap-1.5 border-t border-line px-3 pt-4 text-xs text-muted lg:flex">
            <Kbd>?</Kbd>
            {t('shell.help.title')}
          </p>
        </aside>
        {navOpen && (
          <button
            type="button"
            aria-label={t('shell.closeNav')}
            className="absolute inset-0 z-20 bg-ink/30 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-auto p-4 focus:outline-none sm:p-8 xl:px-12">
          <ErrorBoundary key={location.pathname} title={t('shell.crashTitle')} body={t('shell.crashBody')} retry={t('modules.retry')}>
            <div className="nx-page mx-auto max-w-[88rem]">
            <Routes>
              {PAGES.map(({ path, can, Component }) => (
                <Route
                  key={path}
                  path={path}
                  // UI gating is a convenience (the API is the real boundary); this explains a denied deep link.
                  element={can(access) ? <Component /> : <PageHeader eyebrow="403" title={t('shell.noAccessTitle')} description={t('shell.noAccessBody')} />}
                />
              ))}
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route
                path="*"
                element={
                  <div>
                    <PageHeader eyebrow="404" title={t('shell.notFoundTitle')} description={t('shell.notFoundBody')} />
                    <NavLink to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong">
                      {t('shell.nav.home')}
                      <Icons.ChevronRight className="size-4" aria-hidden />
                    </NavLink>
                  </div>
                }
              />
            </Routes>
            </div>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} goShortcuts={goShortcuts} />
    </div>
  );
}
