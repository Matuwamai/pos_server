import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import locationService from './location.js';

// Same rule as location.service.js: tenantId is never passed explicitly —
// the tenant-scoping Prisma extension injects it from the request context.

async function createTerminal({ locationId, name, deviceIdentifier, platform }) {
  await locationService.getLocationById(locationId); // 404s if missing or belongs to another tenant

  return prisma.terminal.create({
    data: { locationId, name, deviceIdentifier, platform },
  });
}

async function listTerminals(locationId) {
  return prisma.terminal.findMany({
    where: { isActive: true, ...(locationId ? { locationId } : {}) },
    orderBy: { createdAt: 'asc' },
  });
}

async function getTerminalById(id) {
  const terminal = await prisma.terminal.findUnique({ where: { id } });
  if (!terminal) throw ApiError.notFound('Terminal not found');
  return terminal;
}

async function updateTerminal(id, updates) {
  await getTerminalById(id);
  return prisma.terminal.update({ where: { id }, data: updates });
}

async function deactivateTerminal(id) {
  const terminal = await getTerminalById(id);
  if (!terminal.isActive) {
    throw ApiError.conflict('Terminal is already inactive');
  }
  return prisma.terminal.update({ where: { id }, data: { isActive: false } });
}

async function reactivateTerminal(id) {
  const terminal = await getTerminalById(id);
  if (terminal.isActive) {
    throw ApiError.conflict('Terminal is already active');
  }
  return prisma.terminal.update({ where: { id }, data: { isActive: true } });
}

// Called periodically by the till app itself so lastSeenAt reflects whether
// a terminal is actually online, independent of isActive (which reflects a
// staff decision to decommission a device, not connectivity).
async function heartbeat(id) {
  await getTerminalById(id);
  return prisma.terminal.update({ where: { id }, data: { lastSeenAt: new Date() } });
}

export default {
  createTerminal,
  listTerminals,
  getTerminalById,
  updateTerminal,
  deactivateTerminal,
  reactivateTerminal,
  heartbeat,
};
