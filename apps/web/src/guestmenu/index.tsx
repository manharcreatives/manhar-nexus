import { useEffect } from 'react';
import GuestMenu from './GuestMenu';
import { isMockMode, guestMenuToken } from './path';
import { parseMockOptions } from './api';
import './guestmenu.css';

/**
 * Entry of the public QR menu chunk (`/m/:tableToken`). Rendered by App.tsx outside the auth providers:
 * a customer's phone never calls the staff session endpoints.
 */
export default function GuestMenuApp() {
  const token = guestMenuToken(window.location.pathname);
  const mock = isMockMode(window.location.search, import.meta.env.VITE_MENU_MOCK as string | undefined, import.meta.env.PROD) ? parseMockOptions(window.location.search) : null;

  useEffect(() => {
    const prevTitle = document.title;
    document.documentElement.dataset.surface = 'guestmenu';
    document.title = 'Menu';
    // Never index per-table pages (the table token is a secret-ish capability link).
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prevRobots = robots?.content;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex,nofollow,noarchive';
    const theme = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (theme) theme.content = '#070a09';
    return () => {
      delete document.documentElement.dataset.surface;
      document.title = prevTitle;
      if (prevRobots !== undefined && robots) robots.content = prevRobots;
    };
  }, []);

  if (!token) {
    return (
      <main className="gm-fatal">
        <h1>This QR code is not valid</h1>
        <p className="gm-lede">Please ask your waiter for help.</p>
      </main>
    );
  }
  return <GuestMenu token={token} mock={mock} />;
}
