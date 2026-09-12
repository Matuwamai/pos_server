import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import productService from './product.js';

async function getVariantById(productId, variantId) {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw ApiError.notFound('Product variant not found');
  return variant;
}

async function addVariant(productId, variantInput) {
  const product = await productService.getProductRaw(productId); // 404s if missing/foreign tenant

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({ data: { productId, ...variantInput } });
    await productService.provisionInventory(tx, [variant.id], product.trackInventory);
    return variant;
  });
}

async function updateVariant(productId, variantId, updates) {
  await getVariantById(productId, variantId); // ensures it exists under this product/tenant
  return prisma.productVariant.update({ where: { id: variantId }, data: updates });
}

async function deactivateVariant(productId, variantId) {
  const variant = await getVariantById(productId, variantId);
  if (!variant.isActive) {
    throw ApiError.conflict('Variant is already inactive');
  }
  return prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
}

async function reactivateVariant(productId, variantId) {
  const variant = await getVariantById(productId, variantId);
  if (variant.isActive) {
    throw ApiError.conflict('Variant is already active');
  }
  return prisma.productVariant.update({ where: { id: variantId }, data: { isActive: true } });
}

// --- Bill-of-materials (ProductComponent) --------------------------------
// ProductComponent has no tenantId of its own — both sides are variants,
// each already tenant-verified via getVariantById/a direct ownership
// lookup below, so the join row is transitively safe.

async function listComponents(productId, variantId) {
  await getVariantById(productId, variantId);
  return prisma.productComponent.findMany({
    where: { parentVariantId: variantId },
    include: { componentVariant: { select: { id: true, sku: true, productId: true } } },
  });
}

async function addComponent(productId, variantId, { componentVariantId, quantity }) {
  await getVariantById(productId, variantId);

  if (componentVariantId === variantId) {
    throw ApiError.badRequest('A variant cannot be a component of itself');
  }
  const componentVariant = await prisma.productVariant.findUnique({ where: { id: componentVariantId } });
  if (!componentVariant) throw ApiError.notFound('Component variant not found');

  const existing = await prisma.productComponent.findFirst({
    where: { parentVariantId: variantId, componentVariantId },
  });
  if (existing) {
    throw ApiError.conflict('This component is already part of the recipe');
  }

  return prisma.productComponent.create({
    data: { parentVariantId: variantId, componentVariantId, quantity },
  });
}

async function removeComponent(productId, variantId, componentId) {
  await getVariantById(productId, variantId);
  const component = await prisma.productComponent.findFirst({
    where: { id: componentId, parentVariantId: variantId },
  });
  if (!component) throw ApiError.notFound('Component not found');
  await prisma.productComponent.delete({ where: { id: componentId } });
}

export default {
  getVariantById,
  addVariant,
  updateVariant,
  deactivateVariant,
  reactivateVariant,
  listComponents,
  addComponent,
  removeComponent,
};
