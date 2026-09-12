import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

// tenantId is never passed explicitly — the tenant-scoping Prisma extension
// injects it from the request context, same as location.service.js.

const supplierInclude = { _count: { select: { purchaseOrders: true } } };

async function createSupplier({ name, contactEmail, contactPhone }) {
  return prisma.supplier.create({ data: { name, contactEmail, contactPhone }, include: supplierInclude });
}

async function listSuppliers({ search, page, limit }) {
  const where = { isActive: true, ...searchFilter(search, ['name', 'contactEmail', 'contactPhone']) };

  const [total, suppliers] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      ...getPagination({ page, limit }),
      include: supplierInclude,
    }),
  ]);

  return { data: suppliers, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getSupplierById(id) {
  const supplier = await prisma.supplier.findUnique({ where: { id }, include: supplierInclude });
  if (!supplier) throw ApiError.notFound('Supplier not found');
  return supplier;
}

async function updateSupplier(id, updates) {
  await getSupplierById(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  return prisma.supplier.update({ where: { id }, data: updates, include: supplierInclude });
}

async function deactivateSupplier(id) {
  const supplier = await getSupplierById(id);
  if (!supplier.isActive) {
    throw ApiError.conflict('Supplier is already inactive');
  }
  return prisma.supplier.update({ where: { id }, data: { isActive: false } });
}

async function reactivateSupplier(id) {
  const supplier = await getSupplierById(id);
  if (supplier.isActive) {
    throw ApiError.conflict('Supplier is already active');
  }
  return prisma.supplier.update({ where: { id }, data: { isActive: true } });
}

export default { createSupplier, listSuppliers, getSupplierById, updateSupplier, deactivateSupplier, reactivateSupplier };
