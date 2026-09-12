import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { planHasFeature } from '../config/plans.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

// tenantId is never passed explicitly in here — the tenant-scoping Prisma
// extension injects it from the request's AsyncLocalStorage context on
// every call, since Location has a tenantId column. See config/prismaClient.js.

async function createLocation(planCode, { name, address, timezone }) {
  // Every tenant gets one free location (created at signup); a second one
  // requires the multi_location plan feature.
  const existingCount = await prisma.location.count();
  if (existingCount >= 1 && !planHasFeature(planCode, 'multi_location')) {
    throw ApiError.paymentRequired('Your plan only supports a single location. Upgrade to add more.', {
      code: 'FEATURE_NOT_AVAILABLE',
      feature: 'multi_location',
    });
  }

  return prisma.location.create({ data: { name, address, timezone } });
}

async function listLocations({ search, page, limit }) {
  const where = { isActive: true, ...searchFilter(search, ['name', 'address']) };

  const [total, locations] = await prisma.$transaction([
    prisma.location.count({ where }),
    prisma.location.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      ...getPagination({ page, limit }),
    }),
  ]);

  return { data: locations, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getLocationById(id) {
  const location = await prisma.location.findUnique({ where: { id } });
  if (!location) throw ApiError.notFound('Location not found');
  return location;
}

async function updateLocation(id, updates) {
  await getLocationById(id); // ensures it exists (and belongs to this tenant), 404s otherwise
  return prisma.location.update({ where: { id }, data: updates });
}

async function deactivateLocation(id) {
  const location = await getLocationById(id);
  if (!location.isActive) {
    throw ApiError.conflict('Location is already inactive');
  }
  return prisma.location.update({ where: { id }, data: { isActive: false } });
}

async function reactivateLocation(id) {
  const location = await getLocationById(id);
  if (location.isActive) {
    throw ApiError.conflict('Location is already active');
  }
  return prisma.location.update({ where: { id }, data: { isActive: true } });
}

export default { createLocation, listLocations, getLocationById, updateLocation, deactivateLocation, reactivateLocation };
