// The system-defined permission catalog — one entry per distinct action a
// client can request, roughly one per route. This is the complete "menu" a
// tenant assigns from when building or editing a Role; it is never created
// or edited through the API, only seeded (scripts/seedPermissions.js).
//
// Deliberately excludes: super-admin routes (a separate, platform-level
// auth system, not tenant-scoped), auth/signup/login (public), and the
// billing webhook (its own stub auth) — none of those are gated by a
// tenant user's permissions.
const PERMISSIONS = [
  // locations
  { code: 'locations.list', category: 'locations', description: 'List locations' },
  { code: 'locations.read', category: 'locations', description: 'View a location' },
  { code: 'locations.create', category: 'locations', description: 'Create a location' },
  { code: 'locations.update', category: 'locations', description: 'Edit a location' },
  { code: 'locations.deactivate', category: 'locations', description: 'Deactivate a location' },
  { code: 'locations.reactivate', category: 'locations', description: 'Reactivate a location' },

  // terminals
  { code: 'terminals.list', category: 'terminals', description: 'List terminals' },
  { code: 'terminals.read', category: 'terminals', description: 'View a terminal' },
  { code: 'terminals.create', category: 'terminals', description: 'Register a terminal' },
  { code: 'terminals.update', category: 'terminals', description: 'Edit a terminal' },
  { code: 'terminals.deactivate', category: 'terminals', description: 'Deactivate a terminal' },
  { code: 'terminals.reactivate', category: 'terminals', description: 'Reactivate a terminal' },
  { code: 'terminals.heartbeat', category: 'terminals', description: 'Send a terminal heartbeat' },

  // cash drawer sessions
  { code: 'cashDrawerSessions.list', category: 'cashDrawerSessions', description: 'List cash drawer sessions' },
  { code: 'cashDrawerSessions.read', category: 'cashDrawerSessions', description: 'View a cash drawer session' },
  { code: 'cashDrawerSessions.create', category: 'cashDrawerSessions', description: 'Open a cash drawer session' },
  { code: 'cashDrawerSessions.close', category: 'cashDrawerSessions', description: 'Close a cash drawer session' },

  // customer groups
  { code: 'customerGroups.list', category: 'customerGroups', description: 'List customer groups' },
  { code: 'customerGroups.read', category: 'customerGroups', description: 'View a customer group' },
  { code: 'customerGroups.create', category: 'customerGroups', description: 'Create a customer group' },
  { code: 'customerGroups.update', category: 'customerGroups', description: 'Edit a customer group' },
  { code: 'customerGroups.deactivate', category: 'customerGroups', description: 'Deactivate a customer group' },
  { code: 'customerGroups.reactivate', category: 'customerGroups', description: 'Reactivate a customer group' },

  // customers
  { code: 'customers.list', category: 'customers', description: 'List customers' },
  { code: 'customers.read', category: 'customers', description: 'View a customer' },
  { code: 'customers.create', category: 'customers', description: 'Register a customer' },
  { code: 'customers.update', category: 'customers', description: 'Edit a customer' },
  { code: 'customers.deactivate', category: 'customers', description: 'Deactivate a customer' },
  { code: 'customers.reactivate', category: 'customers', description: 'Reactivate a customer' },

  // suppliers
  { code: 'suppliers.list', category: 'suppliers', description: 'List suppliers' },
  { code: 'suppliers.read', category: 'suppliers', description: 'View a supplier' },
  { code: 'suppliers.create', category: 'suppliers', description: 'Create a supplier' },
  { code: 'suppliers.update', category: 'suppliers', description: 'Edit a supplier' },
  { code: 'suppliers.deactivate', category: 'suppliers', description: 'Deactivate a supplier' },
  { code: 'suppliers.reactivate', category: 'suppliers', description: 'Reactivate a supplier' },

  // categories
  { code: 'categories.list', category: 'categories', description: 'List categories' },
  { code: 'categories.read', category: 'categories', description: 'View a category' },
  { code: 'categories.create', category: 'categories', description: 'Create a category' },
  { code: 'categories.update', category: 'categories', description: 'Edit a category' },
  { code: 'categories.deactivate', category: 'categories', description: 'Deactivate a category' },
  { code: 'categories.reactivate', category: 'categories', description: 'Reactivate a category' },

  // modifier groups + modifiers
  { code: 'modifierGroups.list', category: 'modifierGroups', description: 'List modifier groups' },
  { code: 'modifierGroups.read', category: 'modifierGroups', description: 'View a modifier group' },
  { code: 'modifierGroups.create', category: 'modifierGroups', description: 'Create a modifier group' },
  { code: 'modifierGroups.update', category: 'modifierGroups', description: 'Edit a modifier group' },
  { code: 'modifierGroups.deactivate', category: 'modifierGroups', description: 'Deactivate a modifier group' },
  { code: 'modifierGroups.reactivate', category: 'modifierGroups', description: 'Reactivate a modifier group' },
  { code: 'modifiers.list', category: 'modifierGroups', description: 'List modifiers' },
  { code: 'modifiers.read', category: 'modifierGroups', description: 'View a modifier' },
  { code: 'modifiers.create', category: 'modifierGroups', description: 'Create a modifier' },
  { code: 'modifiers.update', category: 'modifierGroups', description: 'Edit a modifier' },
  { code: 'modifiers.deactivate', category: 'modifierGroups', description: 'Deactivate a modifier' },
  { code: 'modifiers.reactivate', category: 'modifierGroups', description: 'Reactivate a modifier' },

  // products, variants, components
  { code: 'products.list', category: 'products', description: 'List products' },
  { code: 'products.read', category: 'products', description: 'View a product' },
  { code: 'products.create', category: 'products', description: 'Create a product' },
  { code: 'products.update', category: 'products', description: 'Edit a product' },
  { code: 'products.deactivate', category: 'products', description: 'Deactivate a product' },
  { code: 'products.reactivate', category: 'products', description: 'Reactivate a product' },
  { code: 'products.import', category: 'products', description: 'Bulk-import products via CSV' },
  { code: 'products.export', category: 'products', description: 'Export products to CSV' },
  { code: 'products.modifierGroups.attach', category: 'products', description: 'Attach a modifier group to a product' },
  { code: 'products.modifierGroups.detach', category: 'products', description: 'Detach a modifier group from a product' },
  { code: 'variants.read', category: 'products', description: 'View a product variant' },
  { code: 'variants.create', category: 'products', description: 'Add a variant to a product' },
  { code: 'variants.update', category: 'products', description: 'Edit a variant' },
  { code: 'variants.deactivate', category: 'products', description: 'Deactivate a variant' },
  { code: 'variants.reactivate', category: 'products', description: 'Reactivate a variant' },
  { code: 'variants.components.list', category: 'products', description: 'List a variant\'s bill-of-materials components' },
  { code: 'variants.components.create', category: 'products', description: 'Add a bill-of-materials component' },
  { code: 'variants.components.delete', category: 'products', description: 'Remove a bill-of-materials component' },

  // inventory
  { code: 'inventory.list', category: 'inventory', description: 'List inventory levels' },
  { code: 'inventory.read', category: 'inventory', description: 'View an inventory item' },
  { code: 'inventory.update', category: 'inventory', description: 'Edit an inventory item\'s low-stock threshold' },
  { code: 'inventory.adjust', category: 'inventory', description: 'Manually adjust stock quantity' },
  { code: 'inventory.logs.list', category: 'inventory', description: 'View the inventory change log' },

  // purchase orders
  { code: 'purchaseOrders.list', category: 'purchaseOrders', description: 'List purchase orders' },
  { code: 'purchaseOrders.read', category: 'purchaseOrders', description: 'View a purchase order' },
  { code: 'purchaseOrders.create', category: 'purchaseOrders', description: 'Create a purchase order' },
  { code: 'purchaseOrders.update', category: 'purchaseOrders', description: 'Edit a draft purchase order' },
  { code: 'purchaseOrders.markOrdered', category: 'purchaseOrders', description: 'Mark a purchase order as ordered' },
  { code: 'purchaseOrders.receive', category: 'purchaseOrders', description: 'Receive stock against a purchase order' },
  { code: 'purchaseOrders.cancel', category: 'purchaseOrders', description: 'Cancel a purchase order' },

  // stock transfers
  { code: 'stockTransfers.list', category: 'stockTransfers', description: 'List stock transfers' },
  { code: 'stockTransfers.read', category: 'stockTransfers', description: 'View a stock transfer' },
  { code: 'stockTransfers.create', category: 'stockTransfers', description: 'Create a stock transfer' },
  { code: 'stockTransfers.markInTransit', category: 'stockTransfers', description: 'Mark a stock transfer in transit' },
  { code: 'stockTransfers.complete', category: 'stockTransfers', description: 'Complete a stock transfer' },
  { code: 'stockTransfers.cancel', category: 'stockTransfers', description: 'Cancel a stock transfer' },

  // loyalty
  { code: 'loyaltyProgram.read', category: 'loyalty', description: 'View the loyalty program configuration' },
  { code: 'loyaltyProgram.create', category: 'loyalty', description: 'Configure the loyalty program' },
  { code: 'loyaltyProgram.update', category: 'loyalty', description: 'Edit the loyalty program configuration' },
  { code: 'loyaltyTransactions.list', category: 'loyalty', description: 'List loyalty transactions' },
  { code: 'loyaltyTransactions.balance', category: 'loyalty', description: 'View a customer\'s points balance' },
  { code: 'loyaltyTransactions.earn', category: 'loyalty', description: 'Award loyalty points' },
  { code: 'loyaltyTransactions.redeem', category: 'loyalty', description: 'Redeem loyalty points' },
  { code: 'loyaltyTransactions.adjust', category: 'loyalty', description: 'Manually adjust a points balance' },

  // store credit
  { code: 'storeCreditTransactions.list', category: 'storeCredit', description: 'List store credit transactions' },
  { code: 'storeCreditTransactions.issue', category: 'storeCredit', description: 'Issue store credit' },
  { code: 'storeCreditTransactions.redeem', category: 'storeCredit', description: 'Redeem store credit' },
  { code: 'storeCreditTransactions.adjust', category: 'storeCredit', description: 'Manually adjust a store credit balance' },

  // gift cards
  { code: 'giftCards.list', category: 'giftCards', description: 'List gift cards' },
  { code: 'giftCards.read', category: 'giftCards', description: 'View a gift card' },
  { code: 'giftCards.create', category: 'giftCards', description: 'Issue a gift card' },
  { code: 'giftCards.redeem', category: 'giftCards', description: 'Redeem a gift card' },
  { code: 'giftCards.reload', category: 'giftCards', description: 'Reload a gift card' },
  { code: 'giftCards.adjust', category: 'giftCards', description: 'Manually adjust a gift card balance' },
  { code: 'giftCards.deactivate', category: 'giftCards', description: 'Deactivate a gift card' },
  { code: 'giftCards.reactivate', category: 'giftCards', description: 'Reactivate a gift card' },
  { code: 'giftCards.transactions.list', category: 'giftCards', description: 'View a gift card\'s transaction history' },

  // promotions
  { code: 'promotions.list', category: 'promotions', description: 'List promotions' },
  { code: 'promotions.read', category: 'promotions', description: 'View a promotion' },
  { code: 'promotions.byCode', category: 'promotions', description: 'Validate a promotion code' },
  { code: 'promotions.create', category: 'promotions', description: 'Create a promotion' },
  { code: 'promotions.update', category: 'promotions', description: 'Edit a promotion' },
  { code: 'promotions.deactivate', category: 'promotions', description: 'Deactivate a promotion' },
  { code: 'promotions.reactivate', category: 'promotions', description: 'Reactivate a promotion' },

  // tax rates
  { code: 'taxRates.list', category: 'taxRates', description: 'List tax rates' },
  { code: 'taxRates.read', category: 'taxRates', description: 'View a tax rate' },
  { code: 'taxRates.default', category: 'taxRates', description: 'View the default tax rate' },
  { code: 'taxRates.create', category: 'taxRates', description: 'Create a tax rate' },
  { code: 'taxRates.update', category: 'taxRates', description: 'Edit a tax rate' },
  { code: 'taxRates.deactivate', category: 'taxRates', description: 'Deactivate a tax rate' },
  { code: 'taxRates.reactivate', category: 'taxRates', description: 'Reactivate a tax rate' },

  // orders
  { code: 'orders.list', category: 'orders', description: 'List orders' },
  { code: 'orders.read', category: 'orders', description: 'View an order' },
  { code: 'orders.create', category: 'orders', description: 'Ring up a sale' },
  { code: 'orders.refund', category: 'orders', description: 'Refund an order' },

  // employee shifts
  { code: 'employeeShifts.clockIn', category: 'employeeShifts', description: 'Clock in' },
  { code: 'employeeShifts.clockOut', category: 'employeeShifts', description: 'Clock out' },
  { code: 'employeeShifts.readOwn', category: 'employeeShifts', description: 'View your own shifts' },
  { code: 'employeeShifts.readAll', category: 'employeeShifts', description: 'View any employee\'s shifts' },

  // audit log
  { code: 'auditLogs.list', category: 'auditLogs', description: 'View the audit log' },

  // payments
  { code: 'payments.list', category: 'payments', description: 'List payments across all orders' },
  { code: 'payments.read', category: 'payments', description: 'View a payment' },
  { code: 'payments.updateStatus', category: 'payments', description: 'Manually override a payment\'s status' },

  // users (staff management)
  { code: 'users.list', category: 'users', description: 'List staff accounts' },
  { code: 'users.read', category: 'users', description: 'View a staff account' },
  { code: 'users.create', category: 'users', description: 'Create a staff account' },
  { code: 'users.update', category: 'users', description: 'Edit a staff account' },
  { code: 'users.deactivate', category: 'users', description: 'Deactivate a staff account' },
  { code: 'users.reactivate', category: 'users', description: 'Reactivate a staff account' },
  { code: 'users.resetPassword', category: 'users', description: 'Reset another staff member\'s password' },

  // roles & permissions administration
  { code: 'roles.list', category: 'roles', description: 'List roles' },
  { code: 'roles.read', category: 'roles', description: 'View a role' },
  { code: 'roles.create', category: 'roles', description: 'Create a role' },
  { code: 'roles.update', category: 'roles', description: 'Edit a role\'s name or permissions' },
  { code: 'roles.deactivate', category: 'roles', description: 'Deactivate a role' },
  { code: 'roles.reactivate', category: 'roles', description: 'Reactivate a role' },
  { code: 'permissions.list', category: 'roles', description: 'List the permission catalog' },

  // API keys
  { code: 'apiKeys.list', category: 'apiKeys', description: 'List API keys' },
  { code: 'apiKeys.create', category: 'apiKeys', description: 'Create an API key' },
  { code: 'apiKeys.revoke', category: 'apiKeys', description: 'Revoke an API key' },
];

export default PERMISSIONS;
