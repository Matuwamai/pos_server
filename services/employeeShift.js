import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import locationService from './location.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';

const shiftInclude = {
  user: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
};


function isPrivileged(permissions) {
  return permissions.has('employeeShifts.readAll');
}

async function clockIn(actingUser, { locationId }) {
  await locationService.getLocationById(locationId); 

  const openShift = await prisma.employeeShift.findFirst({ where: { userId: actingUser.id, clockOut: null } });
  if (openShift) {
    throw ApiError.conflict('You are already clocked in');
  }

  return prisma.employeeShift.create({
    data: { userId: actingUser.id, locationId, clockIn: new Date() },
    include: shiftInclude,
  });
}

async function clockOut(id, actingUser, permissions, { breakMinutes }) {
  const shift = await prisma.employeeShift.findUnique({ where: { id } });
  if (!shift) throw ApiError.notFound('Shift not found');
  if (!isPrivileged(permissions) && shift.userId !== actingUser.id) {
    throw ApiError.forbidden('You can only clock yourself out');
  }
  if (shift.clockOut) {
    throw ApiError.conflict('This shift is already clocked out');
  }

  return prisma.employeeShift.update({
    where: { id },
    data: { clockOut: new Date(), ...(breakMinutes !== undefined ? { breakMinutes } : {}) },
    include: shiftInclude,
  });
}

async function getActiveShift(actingUser) {
  const shift = await prisma.employeeShift.findFirst({ where: { userId: actingUser.id, clockOut: null }, include: shiftInclude });
  if (!shift) throw ApiError.notFound('You are not currently clocked in');
  return shift;
}

async function getShiftById(id, actingUser, permissions) {
  const shift = await prisma.employeeShift.findUnique({ where: { id }, include: shiftInclude });
  if (!shift) throw ApiError.notFound('Shift not found');
  if (!isPrivileged(permissions) && shift.userId !== actingUser.id) {
    throw ApiError.forbidden('You can only view your own shifts');
  }
  return shift;
}
async function listShifts({ userId, locationId, activeOnly, page, limit }, actingUser, permissions) {
  const effectiveUserId = isPrivileged(permissions) ? userId : actingUser.id;

  const where = {
    ...(effectiveUserId ? { userId: effectiveUserId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(activeOnly ? { clockOut: null } : {}),
  };

  const [total, shifts] = await prisma.$transaction([
    prisma.employeeShift.count({ where }),
    prisma.employeeShift.findMany({ where, orderBy: { clockIn: 'desc' }, ...getPagination({ page, limit }), include: shiftInclude }),
  ]);

  return { data: shifts, pagination: buildPaginationMeta({ page, limit, total }) };
}

export default { clockIn, clockOut, getActiveShift, getShiftById, listShifts };
