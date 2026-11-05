import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import locationService from './location.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

async function createTerminal({ locationId, name, deviceIdentifier, platform }) {
  await locationService.getLocationById(locationId); 

  return prisma.terminal.create({
    data: { locationId, name, deviceIdentifier, platform },
  });
}

async function listTerminals({ locationId, search, page, limit }) {
  const where = {
    isActive: true,
    ...(locationId ? { locationId } : {}),
    ...searchFilter(search, ['name', 'deviceIdentifier']),
  };

  const [total, terminals] = await prisma.$transaction([
    prisma.terminal.count({ where }),
    prisma.terminal.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      ...getPagination({ page, limit }),
    }),
  ]);

  return { data: terminals, pagination: buildPaginationMeta({ page, limit, total }) };
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
async function heartbeat(id) {
  await getTerminalById(id);
  return prisma.terminal.update({ where: { id }, data: { lastSeenAt: new Date() } });
}

const terminalService = {
  createTerminal,
  listTerminals,
  getTerminalById,
  updateTerminal,
  deactivateTerminal,
  reactivateTerminal,
  heartbeat,
};

;
const DEVICE_TOKEN_TTL = '365d';

async function enrollDevice(id) {
  const terminal = await getTerminalById(id);
  if (!terminal.isActive) throw ApiError.conflict('Reactivate this terminal before enrolling its device');
  const token = jwt.sign(
    { sub: terminal.id, tenantId: terminal.tenantId, tv: terminal.tokenVersion, type: 'terminal' },
    process.env.JWT_SECRET,
    { expiresIn: DEVICE_TOKEN_TTL }
  );
  return { terminalId: terminal.id, token, expiresIn: DEVICE_TOKEN_TTL };
}

async function revokeDevice(id) {
  await getTerminalById(id);
  await prisma.terminal.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
  return { terminalId: id, revoked: true };
}

export default { ...terminalService, enrollDevice, revokeDevice };
