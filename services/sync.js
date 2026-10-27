import prisma from '../config/prismaClient.js';
import locationService from './location.js';

const DEFAULT_LIMIT = 500;


// Each catalog type is pulled independently, ordered by updatedAt. If a type
// fills its page, the cursor for the whole response is pulled back to that
// type's last timestamp, so nothing it skipped is lost. Rows at the boundary
// are returned again next time — clients upsert, so that is harmless.
const ENTITY_QUERIES = {
  locations: { model: 'location', where: () => ({}), select: { id: true, name: true, timezone: true, isActive: true, updatedAt: true } },
  categories: { model: 'category', where: () => ({}), select: { id: true, name: true, parentId: true, isActive: true, updatedAt: true } },
  products: {
    model: 'product',
    where: () => ({}),
    select: {
      id: true, categoryId: true, name: true, description: true, isComposite: true, trackInventory: true, isActive: true, updatedAt: true,
      modifierGroups: { select: { modifierGroupId: true } },
    },
  },
  variants: {
    model: 'productVariant',
    where: () => ({}),
    select: { id: true, productId: true, sku: true, barcode: true, attributes: true, price: true, cost: true, taxRateId: true, isActive: true, updatedAt: true },
  },
  modifierGroups: { model: 'modifierGroup', where: () => ({}), select: { id: true, name: true, minSelect: true, maxSelect: true, isActive: true, updatedAt: true } },
  modifiers: { model: 'modifier', where: () => ({}), select: { id: true, modifierGroupId: true, name: true, priceAdjustment: true, isActive: true, updatedAt: true } },
  taxRates: { model: 'taxRate', where: () => ({}), select: { id: true, name: true, rate: true, isDefault: true, isActive: true, updatedAt: true } },
  promotions: {
    model: 'promotion',
    where: () => ({}),
    select: { id: true, name: true, code: true, type: true, value: true, minSubtotal: true, startsAt: true, endsAt: true, isActive: true, updatedAt: true },
  },
  customerGroups: { model: 'customerGroup', where: () => ({}), select: { id: true, name: true, discountPercentage: true, isActive: true, updatedAt: true } },
  customers: {
    model: 'customer',
    where: () => ({}),
    select: { id: true, customerGroupId: true, name: true, phone: true, email: true, storeCreditBalance: true, isActive: true, updatedAt: true },
  },
};

// Stock is only meaningful for the terminal's own location, so it is scoped
// to one locationId rather than the whole tenant.
function inventoryQuery(locationId) {
  return {
    model: 'inventoryItem',
    where: () => ({ locationId }),
    select: { id: true, variantId: true, locationId: true, quantity: true, lowStockThreshold: true, updatedAt: true },
  };
}

async function pullChanges({ since, locationId, limit = DEFAULT_LIMIT }) {
  const location = await locationService.getLocationById(locationId); // 404s if missing/foreign tenant
  const sinceDate = new Date(since);
  // Captured before any query runs, so a row written while we read is still
  // picked up by the next pull (its updatedAt is at or after this moment).
  const serverTime = Date.now();

  const queries = { ...ENTITY_QUERIES, inventory: inventoryQuery(location.id) };
  const entities = {};
  let nextSince = serverTime;
  let hasMore = false;

  // Staff roster for offline PIN login. The PIN is sent as its bcrypt hash
  // (verified on the till) and permissions are resolved here, so the till
  // enforces the same access the server would. Password hashes never leave.
  const userRows = await prisma.user.findMany({
    where: { isActive: true, updatedAt: { gte: sinceDate } },
    select: {
      id: true, name: true, role: true, assignedRoleId: true, pinCode: true, mustChangePassword: true, updatedAt: true,
      assignedRole: { select: { isActive: true, permissions: { select: { permission: { select: { code: true } } } } } },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });
  entities.users = userRows.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    permissions: u.assignedRole?.isActive ? u.assignedRole.permissions.map((rp) => rp.permission.code) : [],
    pinHash: u.pinCode,
    mustChangePassword: u.mustChangePassword,
    updatedAt: u.updatedAt.toISOString(),
  }));
  if (userRows.length === limit) {
    hasMore = true;
    nextSince = Math.min(nextSince, userRows[userRows.length - 1].updatedAt.getTime());
  }

  for (const [name, q] of Object.entries(queries)) {
    const rows = await prisma[q.model].findMany({
      where: { ...q.where(), updatedAt: { gte: sinceDate } },
      select: q.select,
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    entities[name] = rows.map(normalise);
    if (rows.length === limit) {
      hasMore = true;
      const last = rows[rows.length - 1].updatedAt.getTime();
      nextSince = Math.min(nextSince, last);
    }
  }

  return { serverTime, nextSince, hasMore, limit, entities };
}

// Decimals serialise as strings from Prisma; the terminal should get plain
// numbers for money and quantities, and ISO strings for dates.
function normalise(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object' && typeof v.toNumber === 'function') out[k] = v.toNumber();
    else if (v instanceof Date) out[k] = v.toISOString();
    else if (k === 'modifierGroups' && Array.isArray(v)) out.modifierGroupIds = v.map((j) => j.modifierGroupId);
    else out[k] = v;
  }
  delete out.modifierGroups;
  return out;
}

export default { pullChanges };
