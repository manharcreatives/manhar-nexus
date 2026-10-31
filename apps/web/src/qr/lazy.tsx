import { lazy, Suspense } from 'react';
import { Skeleton } from '../ui/states';

/**
 * The QR screens pull in the `qrcode` generator, image tools and print layouts; they load on
 * demand so none of that lands in the entry bundle. (The provider + badges stay eager: tiny.)
 */
const Hub = lazy(() => import('./TableQrPage'));
const Inbox = lazy(() => import('./GuestOrdersPage'));

const fallback = (
  <div role="status" aria-busy="true" className="space-y-4">
    <Skeleton className="h-12 w-64" />
    <Skeleton className="h-64" />
  </div>
);

export function TableQrRoute() {
  return (
    <Suspense fallback={fallback}>
      <Hub />
    </Suspense>
  );
}

export function GuestOrdersRoute() {
  return (
    <Suspense fallback={fallback}>
      <Inbox />
    </Suspense>
  );
}
