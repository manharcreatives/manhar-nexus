import type { PermissionDefinition } from '../iam/permission.registry';

/** A step in the module setup wizard. */
export interface ModuleSetupStep {
  /** Stable key unique within the module. */
  key: string;
  label: string;
  description: string;
  /** If true the module cannot move to ACTIVE without this step marked done. */
  required: boolean;
}

/**
 * Compile-time definition of a Nexus module — registered once at startup.
 * Only the per-business activation state lives in the database; the manifest
 * itself is always authoritative from code.
 */
export interface ModuleManifest {
  /** Stable machine key, kebab-case. e.g. "restaurant", "catalog". */
  key: string;
  name: string;
  description: string;
  /** Module keys that must be ACTIVE before this module can be activated. */
  dependencies: string[];
  /** Permissions this module contributes to the PermissionRegistry on startup. */
  permissions: PermissionDefinition[];
  /** Default config applied when the activation record is first created. */
  defaultConfig: Record<string, unknown>;
  /** Ordered steps for the setup wizard. All required steps must complete before ACTIVE. */
  setupSteps: ModuleSetupStep[];
}

/**
 * Built-in module catalog — the initial set of Nexus modules.
 * Vertical modules (restaurant/catalog/checkout) are defined here; their API
 * surfaces are wired in later phases (P7+). Registering them now:
 *   - enables DAG validation from day one
 *   - lets businesses see what's coming and plan their setup
 *   - allows platform staff to pre-activate modules during provisioning
 */
export const BUILT_IN_MODULES: ModuleManifest[] = [
  {
    key: 'restaurant',
    name: 'Restaurant Operations',
    description: 'Table management, guest sessions, service requests, and kitchen workflow.',
    dependencies: [],
    permissions: [
      { module: 'restaurant', resource: 'session', action: 'view', description: 'View guest sessions' },
      { module: 'restaurant', resource: 'session', action: 'manage', description: 'Manage guest sessions' },
      { module: 'restaurant', resource: 'table', action: 'view', description: 'View dining tables' },
      { module: 'restaurant', resource: 'table', action: 'manage', description: 'Manage dining tables' },
      { module: 'restaurant', resource: 'booking', action: 'view', description: 'View bookings' },
      { module: 'restaurant', resource: 'booking', action: 'manage', description: 'Manage bookings' },
      { module: 'restaurant', resource: 'dining', action: 'view', description: 'View dining areas and tables' },
      { module: 'restaurant', resource: 'dining', action: 'manage', description: 'Manage dining areas and tables' },
      { module: 'restaurant', resource: 'staff', action: 'view', description: 'View staff profiles' },
      { module: 'restaurant', resource: 'staff', action: 'manage', description: 'Manage staff profiles' },
      { module: 'restaurant', resource: 'guest', action: 'view', description: 'View guest profiles' },
      { module: 'restaurant', resource: 'guest', action: 'manage', description: 'Manage guest profiles' },
      { module: 'restaurant', resource: 'order', action: 'view', description: 'View service requests (orders)' },
      { module: 'restaurant', resource: 'order', action: 'manage', description: 'Manage service requests (orders)' },
      { module: 'restaurant', resource: 'order', action: 'edit', description: 'Edit a sent order before the kitchen starts it' },
      { module: 'restaurant', resource: 'kitchen', action: 'view', description: 'View kitchen queue' },
      { module: 'restaurant', resource: 'kitchen', action: 'manage', description: 'Update kitchen order status' },
      { module: 'restaurant', resource: 'bill', action: 'show', description: 'Show the customer-facing bill at the table' },
      { module: 'restaurant', resource: 'production', action: 'view', description: 'View production areas' },
      { module: 'restaurant', resource: 'production', action: 'manage', description: 'Manage production areas' },
    ],
    defaultConfig: {},
    setupSteps: [
      {
        key: 'first_location',
        label: 'Create First Location',
        description: 'Add at least one operating location before activating.',
        required: true,
      },
      {
        key: 'business_type',
        label: 'Confirm Business Type',
        description: 'Ensure the business type is set to restaurant, café, or QSR.',
        required: false,
      },
    ],
  },
  {
    key: 'catalog',
    name: 'Product Catalog',
    description: 'Menu categories, items, variants, modifier groups, and availability rules.',
    dependencies: ['restaurant'],
    permissions: [
      { module: 'catalog', resource: 'taxcategory', action: 'view', description: 'View tax categories' },
      { module: 'catalog', resource: 'taxcategory', action: 'manage', description: 'Manage tax categories' },
      { module: 'catalog', resource: 'category', action: 'view', description: 'View catalog categories' },
      { module: 'catalog', resource: 'category', action: 'manage', description: 'Manage catalog categories' },
      { module: 'catalog', resource: 'item', action: 'view', description: 'View catalog items' },
      { module: 'catalog', resource: 'item', action: 'manage', description: 'Manage catalog items' },
      { module: 'catalog', resource: 'variant', action: 'view', description: 'View catalog item variants' },
      { module: 'catalog', resource: 'variant', action: 'manage', description: 'Manage catalog item variants' },
      { module: 'catalog', resource: 'modifier', action: 'view', description: 'View modifier groups' },
      { module: 'catalog', resource: 'modifier', action: 'manage', description: 'Manage modifier groups' },
    ],
    defaultConfig: {},
    setupSteps: [
      {
        key: 'first_category',
        label: 'Create First Category',
        description: 'Add at least one menu category.',
        required: true,
      },
    ],
  },
  {
    key: 'checkout',
    name: 'Checkout & Payments',
    description: 'Tax engine, invoices, payment methods, cash counter, and shift reconciliation.',
    dependencies: ['catalog'],
    permissions: [
      { module: 'checkout', resource: 'invoice', action: 'view', description: 'View invoices' },
      { module: 'checkout', resource: 'invoice', action: 'create', description: 'Create invoices' },
      { module: 'checkout', resource: 'payment', action: 'view', description: 'View payments' },
      { module: 'checkout', resource: 'payment', action: 'process', description: 'Process payments' },
      { module: 'checkout', resource: 'shift', action: 'manage', description: 'Manage shift reconciliation' },
      { module: 'checkout', resource: 'paymentqr', action: 'show', description: 'Show the UPI payment QR to a customer' },
    ],
    defaultConfig: {},
    setupSteps: [
      {
        key: 'tax_config',
        label: 'Configure Tax Rules',
        description: 'Set up applicable tax slabs before going live.',
        required: true,
      },
      {
        key: 'payment_methods',
        label: 'Enable Payment Methods',
        description: 'Enable at least one payment method.',
        required: true,
      },
    ],
  },
  {
    key: 'reports',
    name: 'Reports & Analytics',
    description: 'Daily closing reports, sales analytics, and activity history exports.',
    dependencies: [],
    permissions: [
      { module: 'reports', resource: 'daily', action: 'view', description: 'View daily closing reports' },
      { module: 'reports', resource: 'sales', action: 'view', description: 'View sales analytics' },
      { module: 'reports', resource: 'export', action: 'run', description: 'Export reports' },
    ],
    defaultConfig: {},
    setupSteps: [],
  },
  {
    key: 'printing',
    name: 'Printing & Hardware',
    description: 'Receipt/KOT printing via local print agent, printer profiles, device routing.',
    dependencies: ['checkout'],
    permissions: [
      { module: 'printing', resource: 'printer', action: 'view', description: 'View printers' },
      { module: 'printing', resource: 'printer', action: 'manage', description: 'Manage printers' },
      { module: 'printing', resource: 'job', action: 'view', description: 'View print jobs' },
      { module: 'printing', resource: 'job', action: 'reprint', description: 'Reprint jobs' },
    ],
    defaultConfig: {},
    setupSteps: [
      {
        key: 'printer_profile',
        label: 'Add Printer Profile',
        description: 'Configure at least one printer profile.',
        required: true,
      },
    ],
  },
  {
    key: 'costs',
    name: 'Operating Costs',
    description: 'Track business expenses by category with optional approval workflow. Works for any business type.',
    dependencies: [],
    permissions: [
      { module: 'costs', resource: 'category', action: 'view', description: 'View expense categories' },
      { module: 'costs', resource: 'category', action: 'manage', description: 'Manage expense categories' },
      { module: 'costs', resource: 'expense', action: 'view', description: 'View expenses' },
      { module: 'costs', resource: 'expense', action: 'create', description: 'Create expenses' },
      { module: 'costs', resource: 'expense', action: 'approve', description: 'Approve or reject expenses' },
    ],
    defaultConfig: {},
    setupSteps: [
      {
        key: 'first_category',
        label: 'Create First Expense Category',
        description: 'Add at least one expense category (e.g. Rent, Utilities, Staff Wages) before tracking costs.',
        required: true,
      },
    ],
  },
];
