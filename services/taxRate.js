import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

// Only one TaxRate can be the tenant's default at a time — clearing every
// other one whenever a new default is set, in the same transaction as the
// write that sets it, so there's never a moment with zero or two defaults
// visible to a concurrent reader.
async function clearOtherDefaults(tx, excludeId) {
  await tx.taxRate.updateMany({
    where: { isDefault: true, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    data: { isDefault: false },
  });
}

async function createTaxRate({ name, rate, region, isDefault }) {
  return prisma.$transaction(async (tx) => {
    if (isDefault) {
      await clearOtherDefaults(tx);
    }
    return tx.taxRate.create({ data: { name, rate, region, isDefault: !!isDefault } });
  });
}

async function listTaxRates({ search, page, limit }) {
  const where = { isActive: true, ...searchFilter(search, ['name', 'region']) };

  const [total, taxRates] = await prisma.$transaction([
    prisma.taxRate.count({ where }),
    prisma.taxRate.findMany({ where, orderBy: { name: 'asc' }, ...getPagination({ page, limit }) }),
  ]);

  return { data: taxRates, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getTaxRateById(id) {
  const taxRate = await prisma.taxRate.findUnique({ where: { id } });
  if (!taxRate) throw ApiError.notFound('Tax rate not found');
  return taxRate;
}

async function getDefaultTaxRate() {
  const taxRate = await prisma.taxRate.findFirst({ where: { isDefault: true, isActive: true } });
  if (!taxRate) throw ApiError.notFound('No default tax rate has been set');
  return taxRate;
}

async function updateTaxRate(id, updates) {
  await getTaxRateById(id); // ensures it exists (and belongs to this tenant), 404s otherwise

  return prisma.$transaction(async (tx) => {
    if (updates.isDefault) {
      await clearOtherDefaults(tx, id);
    }
    return tx.taxRate.update({ where: { id }, data: updates });
  });
}

async function deactivateTaxRate(id) {
  const taxRate = await getTaxRateById(id);
  if (!taxRate.isActive) {
    throw ApiError.conflict('Tax rate is already inactive');
  }
  // A deactivated rate can't stay "the default" — new variants shouldn't
  // silently inherit a rate nobody can see or select anymore.
  return prisma.taxRate.update({ where: { id }, data: { isActive: false, isDefault: false } });
}

async function reactivateTaxRate(id) {
  const taxRate = await getTaxRateById(id);
  if (taxRate.isActive) {
    throw ApiError.conflict('Tax rate is already active');
  }
  return prisma.taxRate.update({ where: { id }, data: { isActive: true } });
}

export default {
  createTaxRate,
  listTaxRates,
  getTaxRateById,
  getDefaultTaxRate,
  updateTaxRate,
  deactivateTaxRate,
  reactivateTaxRate,
};
