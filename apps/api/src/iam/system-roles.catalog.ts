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
      'restaurant.kitchen.view',
      'restaurant.kitchen.manage',
      'restaurant.booking.view',
      'restaurant.booking.manage',
      // Checkout (module-manifest keys)
      'checkout.invoice.view',
      'checkout.invoice.create',
      'checkout.payment.view',
      'checkout.payment.process',
      'checkout.shift.manage',
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
      // Restaurant (view sessions/orders to link invoices)
      'restaurant.session.view',
      'restaurant.order.view',
      // Checkout (module-manifest keys)
      'checkout.invoice.view',
      'checkout.invoice.create',
      'checkout.payment.view',
      'checkout.payment.process',
      'checkout.shift.manage',
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
      // Read-only kitchen queue: waiters see when their tickets are ready.
      'restaurant.kitchen.view',
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
    ],
  },
  {
    key: 'kitchen-team',
    name: 'Kitchen Team',
    description: 'Kitchen Operations Screen only',
    realm: 'BUSINESS',
    permissions: [
      'core.notification.view',
      // Restaurant (kitchen queue only)
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
      'core.audit.view',
      'core.audit.export',
      'core.notification.view',
      'reports.daily.view',
      'reports.sales.view',
      // Operating Costs (view + approve; cannot create expenses)
      'costs.category.view',
      'costs.expense.view',
      'costs.expense.approve',
    ],
  },
];
