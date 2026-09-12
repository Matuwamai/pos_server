import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import modifierGroupService from './modifierGroup.js';

// Modifier has no tenantId of its own — every lookup goes through its
// parent ModifierGroup (which does), so cross-tenant access is blocked
// transitively: getModifierGroupById 404s on a foreign-tenant group before
// any Modifier row is ever touched.

async function createModifier(modifierGroupId, { name, priceAdjustment }) {
  await modifierGroupService.getModifierGroupById(modifierGroupId);
  return prisma.modifier.create({ data: { modifierGroupId, name, priceAdjustment } });
}

async function listModifiers(modifierGroupId) {
  await modifierGroupService.getModifierGroupById(modifierGroupId);
  return prisma.modifier.findMany({ where: { modifierGroupId, isActive: true }, orderBy: { name: 'asc' } });
}

async function getModifierById(modifierGroupId, id) {
  await modifierGroupService.getModifierGroupById(modifierGroupId);
  const modifier = await prisma.modifier.findFirst({ where: { id, modifierGroupId } });
  if (!modifier) throw ApiError.notFound('Modifier not found');
  return modifier;
}

async function updateModifier(modifierGroupId, id, updates) {
  await getModifierById(modifierGroupId, id);
  return prisma.modifier.update({ where: { id }, data: updates });
}

async function deactivateModifier(modifierGroupId, id) {
  const modifier = await getModifierById(modifierGroupId, id);
  if (!modifier.isActive) {
    throw ApiError.conflict('Modifier is already inactive');
  }
  return prisma.modifier.update({ where: { id }, data: { isActive: false } });
}

async function reactivateModifier(modifierGroupId, id) {
  const modifier = await getModifierById(modifierGroupId, id);
  if (modifier.isActive) {
    throw ApiError.conflict('Modifier is already active');
  }
  return prisma.modifier.update({ where: { id }, data: { isActive: true } });
}

export default { createModifier, listModifiers, getModifierById, updateModifier, deactivateModifier, reactivateModifier };
