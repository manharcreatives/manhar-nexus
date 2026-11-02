import { WILDCARD } from './permission.registry';

/** A seeded system role (businessId NULL, isSystem true). */
export interface SystemRoleDefinition {
  key: string;
  name: string;
  description: string;
  realm: 'PLATFORM' | 'BUSINESS';
  /** Permission keys, or [WILDCARD] for full access within the role's realm/scope. */
  permissions: string[];
}

/**
 * System role templates (Restaurant Module B). Operational permissions for
 * vertical modules (catalog/checkout/kitchen…) do not exist yet; those roles
 * are seeded with the relevant CORE permissions now and enriched when modules
 * register their permissions (Phase 5+). Owner and platform-admin hold the
 * wildcard so new permissions are covered automatically.
 */
export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    key: 'platform-admin',
    name: 'Platform Administrator',
    description: 'Manhar internal staff — full cross-business access',
    realm: 'PLATFORM',
    permissions: [WILDCARD],
  },
  {
    key: 'owner',
    name: 'Owner',
    description: 'Business owner — full control of their business',
    realm: 'BUSINESS',
    permissions: [WILDCARD],
  },
  {
    key: 'location-manager',
    name: 'Location Manager',
    description: 'Daily location operations + reports',
    realm: 'BUSINESS',
    permissions: [
      'core.business.view',
      'core.location.view',
      'core.location.edit',
      'core.setting.view',
      'core.setting.edit',
      'core.user.view',
      'core.audit.view',
      'core.numbering.view',
      'core.numbering.manage',
      'core.notification.view',
      // Alert rules (Settings > Alerts tab): the manager configures their own location's alerts.
      'core.alert.view',
      'core.alert.edit',
      'reports.daily.view',
      'reports.sales.view',
      // Catalog (module-manifest keys)
      'catalog.taxcategory.view',
      'catalog.taxcategory.manage',
      'catalog.category.view',
      'catalog.category.manage',
      'catalog.item.view',
      'catalog.item.manage',
      'catalog.variant.view',
      'catalog.variant.manage',
      'catalog.modifier.view',
      'catalog.modifier.manage',
      // Restaurant (module-manifest keys)
      'restaurant.dining.view',
      'restaurant.dining.manage',
      'restaurant.table.view',
      'restaurant.table.manage',
      'restaurant.session.view',
      'restaurant.session.manage',
      'restaurant.order.view',
      'restaurant.order.manage',
      'restaurant.order.edit',
      'restaurant.kitchen.view',
      'restaurant.kitchen.manage',
      'restaurant.booking.view',
      'restaurant.booking.manage',
      'restaurant.bill.show',
      // QR digital menu (ADR-035): QR codes + photos + policy, and the guest-order inbox
      'restaurant.qr.manage',
      'restaurant.guestorder.manage',
      // Checkout (module-manifest keys)
      'checkout.invoice.view',
      'checkout.invoice.create',
      'checkout.payment.view',
      'checkout.payment.process',
      'checkout.shift.manage',
      'checkout.paymentqr.show',
      // Operating Costs (module-manifest keys)
      'costs.category.view',
      'costs.category.manage',
      'costs.expense.view',
      'costs.expense.create',
      'costs.expense.approve',
    ],
  },
  {
    key: 'checkout-associate',
    name: 'Checkout Associate',
    description: 'Checkout & payments + shift reconciliation',
    realm: 'BUSINESS',
    permissions: [
      'core.business.view',
      'core.location.view',
      'core.numbering.view',
      'core.notification.view',
      'reports.daily.view',
      // Catalog (view only — needed to display line items)
      'catalog.item.view',
      'catalog.category.view',
      // Restaurant (view floor + sessions/orders to link invoices; the Tables page lists areas/tables)
      'restaurant.dining.view',
      'restaurant.session.view',
      'restaurant.order.view',
      // Show the bill / payment QR to a guest from the cashier desk
      'restaurant.bill.show',
      // Checkout (module-manifest keys)
      'checkout.invoice.view',
      'checkout.invoice.create',
      'checkout.payment.view',
      'checkout.payment.process',
      'checkout.shift.manage',
      'checkout.paymentqr.show',
    ],
  },
  {
    key: 'service-team',
    name: 'Service Team',
    description: 'Dining area + assigned service requests',
    realm: 'BUSINESS',
    permissions: [
      'core.location.view',
      'core.notification.view',
      // Catalog (view for order taking)
      'catalog.category.view',
      'catalog.item.view',
      'catalog.modifier.view',
      // Restaurant (full floor and order flow)
      'restaurant.dining.view',
      'restaurant.table.view',
      'restaurant.session.view',
      'restaurant.session.manage',
      'restaurant.order.view',
      'restaurant.order.manage',
      'restaurant.order.edit',
      // QR digital menu: waiters confirm / reject / edit guest orders and acknowledge waiter calls.
      'restaurant.guestorder.manage',
      // Read-only kitchen queue: waiters see when their tickets are ready.
      'restaurant.kitchen.view',
      // Take the generated bill and the payment QR to the table (cannot generate bills or record payments).
      'restaurant.bill.show',
      'checkout.paymentqr.show',
    ],
  },
  {
    key: 'host',
    name: 'Host / Reception',
    description: 'Bookings + dining area',
    realm: 'BUSINESS',
    permissions: [
      'core.location.view',
      'core.notification.view',
      // Restaurant (seating + read-only orders)
      'restaurant.dining.view',
      'restaurant.dining.manage',
      'restaurant.table.view',
      'restaurant.table.manage',
      'restaurant.session.view',
      'restaurant.session.manage',
      'restaurant.booking.view',
      'restaurant.booking.manage',
      'restaurant.order.view',
      // Catalog (view only: the Tables page loads the menu for its order panel)
      'catalog.category.view',
      'catalog.item.view',
      'catalog.modifier.view',
    ],
  },
  {
    key: 'kitchen-team',
    name: 'Kitchen Team',
    description: 'Kitchen Operations Screen only',
    realm: 'BUSINESS',
    permissions: [
      'core.notification.view',
      // Restaurant (kitchen queue only; dining.view + session.view are read-only lookups the queue uses for table names / guests)
      'restaurant.dining.view',
      'restaurant.session.view',
      'restaurant.order.view',
      'restaurant.kitchen.view',
      'restaurant.kitchen.manage',
    ],
  },
  {
    key: 'stock-control-manager',
    name: 'Stock Control Manager',
    description: 'Stock control + purchases',
    realm: 'BUSINESS',
    permissions: ['core.location.view', 'core.notification.view'],
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description: 'Operating costs + financial reports',
    realm: 'BUSINESS',
    permissions: [
      'core.business.view',
      // Costs filters by location
      'core.location.view',
      'core.audit.view',
      'core.audit.export',
      'core.notification.view',
      'reports.daily.view',
      'reports.sales.view',
      // Bills (read-only: list, inspect lines and payments; no refund/void)
      'checkout.invoice.view',
      'checkout.payment.view',
      // Operating Costs (view + approve; cannot create expenses)
      'costs.category.view',
      'costs.expense.view',
      'costs.expense.approve',
    ],
  },
];
