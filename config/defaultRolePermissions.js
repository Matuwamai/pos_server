import PERMISSIONS from './permissions.js';

const ALL_CODES = PERMISSIONS.map((p) => p.code);

// Only an OWNER manages who can do what — a MANAGER gets everything else.
const OWNER_ONLY_CODES = new Set(['roles.list', 'roles.read', 'roles.create', 'roles.update', 'roles.deactivate', 'roles.reactivate', 'permissions.list', 'apiKeys.list', 'apiKeys.create', 'apiKeys.revoke']);

const MANAGER_CODES = ALL_CODES.filter((code) => !OWNER_ONLY_CODES.has(code));

// Till-facing staff: sell, take payment methods, look things up. No editing
// of catalog/config, no reports, no staff/role administration.
const CASHIER_CODES = [
  'locations.list', 'locations.read',
  'terminals.list', 'terminals.read', 'terminals.heartbeat',
  'cashDrawerSessions.list', 'cashDrawerSessions.read', 'cashDrawerSessions.create', 'cashDrawerSessions.close',
  'customerGroups.list', 'customerGroups.read',
  'customers.list', 'customers.read', 'customers.create',
  'categories.list', 'categories.read',
  'modifierGroups.list', 'modifierGroups.read', 'modifiers.list', 'modifiers.read',
  'products.list', 'products.read', 'variants.read', 'variants.components.list',
  'inventory.list', 'inventory.read',
  'loyaltyProgram.read', 'loyaltyTransactions.list', 'loyaltyTransactions.balance', 'loyaltyTransactions.earn', 'loyaltyTransactions.redeem',
  'storeCreditTransactions.list', 'storeCreditTransactions.issue', 'storeCreditTransactions.redeem',
  'giftCards.list', 'giftCards.read', 'giftCards.create', 'giftCards.redeem', 'giftCards.reload', 'giftCards.transactions.list',
  'promotions.list', 'promotions.read', 'promotions.byCode',
  'taxRates.list', 'taxRates.read', 'taxRates.default',
  'orders.list', 'orders.read', 'orders.create',
  'employeeShifts.clockIn', 'employeeShifts.clockOut', 'employeeShifts.readOwn',
];

// Everything CASHIER has (catalog/reference lookups), plus full ownership
// of the supply-chain resources — matches the existing
// requireRole('OWNER','MANAGER','INVENTORY_CLERK') routes exactly.
const INVENTORY_CLERK_CODES = [
  ...CASHIER_CODES,
  'suppliers.list', 'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.deactivate', 'suppliers.reactivate',
  'purchaseOrders.list', 'purchaseOrders.read', 'purchaseOrders.create', 'purchaseOrders.update', 'purchaseOrders.markOrdered', 'purchaseOrders.receive', 'purchaseOrders.cancel',
  'stockTransfers.list', 'stockTransfers.read', 'stockTransfers.create', 'stockTransfers.markInTransit', 'stockTransfers.complete', 'stockTransfers.cancel',
  'inventory.update', 'inventory.adjust', 'inventory.logs.list',
];

// Read/reporting access across every financially-relevant resource, no
// operational mutation rights — not one of the roles any existing route
// already granted, defined fresh for the "books and payroll" persona.
const ACCOUNTANT_CODES = [
  'orders.list', 'orders.read',
  'salesSummary.list', 'salesSummary.totals',
  'payments.list', 'payments.read', 'payments.updateStatus',
  'auditLogs.list',
  'purchaseOrders.list', 'purchaseOrders.read',
  'inventory.list', 'inventory.read', 'inventory.logs.list',
  'taxRates.list', 'taxRates.read', 'taxRates.default',
  'promotions.list', 'promotions.read',
  'giftCards.list', 'giftCards.read', 'giftCards.transactions.list',
  'loyaltyProgram.read', 'loyaltyTransactions.list', 'loyaltyTransactions.balance',
  'storeCreditTransactions.list',
  'customers.list', 'customers.read', 'customerGroups.list', 'customerGroups.read',
  'suppliers.list', 'suppliers.read',
  'products.list', 'products.read', 'categories.list', 'categories.read',
  'locations.list', 'locations.read', 'terminals.list', 'terminals.read',
  'users.list', 'users.read',
  'employeeShifts.readAll', 'employeeShifts.readOwn', 'employeeShifts.clockIn', 'employeeShifts.clockOut',
  // Collecting on and reviewing invoices is bookkeeping work; granting
  // credit terms (create/update/issue) or writing one off (void) stays
  // with OWNER/MANAGER.
  'invoices.list', 'invoices.read', 'invoices.recordPayment',
];

// Seeded verbatim for every tenant (services/role.js's seedDefaultRolesForTenant).
// A tenant is free to edit any of these afterward — this is only the
// starting point, not a fixed mapping enforced anywhere else.
const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: ALL_CODES,
  MANAGER: MANAGER_CODES,
  CASHIER: CASHIER_CODES,
  INVENTORY_CLERK: INVENTORY_CLERK_CODES,
  ACCOUNTANT: ACCOUNTANT_CODES,
};

export default DEFAULT_ROLE_PERMISSIONS;
