import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import categoryService from './category.js';
import modifierGroupService from './modifierGroup.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

const productInclude = {
  category: { select: { id: true, name: true } },
  variants: { orderBy: { createdAt: 'asc' } },
  modifierGroups: {
    include: {
      modifierGroup: {
        select: {
          id: true,
          name: true,
          minSelect: true,
          maxSelect: true,
          modifiers: { where: { isActive: true }, select: { id: true, name: true, priceAdjustment: true } },
        },
      },
    },
  },
};
function serializeProduct(product) {
  if (!product) return product;
  const { modifierGroups, ...rest } = product;
  return { ...rest, modifierGroups: modifierGroups.map((pmg) => pmg.modifierGroup) };
}
async function provisionInventory(tx, variantIds, trackInventory) {
  if (!trackInventory || variantIds.length === 0) return;
  const locations = await tx.location.findMany({ where: { isActive: true }, select: { id: true } });
  if (locations.length === 0) return;
  await tx.inventoryItem.createMany({
    data: variantIds.flatMap((variantId) =>
      locations.map((location) => ({ variantId, locationId: location.id, quantity: 0 }))
    ),
  });
}

async function createProduct({ categoryId, name, description, isComposite, trackInventory, variants }) {
  if (categoryId) {
    await categoryService.getCategoryById(categoryId); // 404s if missing/foreign tenant
  }

  const productId = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: { categoryId, name, description, isComposite, trackInventory },
    });

    const createdVariantIds = [];
    for (const variantInput of variants) {
      const variant = await tx.productVariant.create({ data: { productId: product.id, ...variantInput } });
      createdVariantIds.push(variant.id);
    }

    await provisionInventory(tx, createdVariantIds, product.trackInventory);

    return product.id;
  });

  return getProductById(productId);
}

async function listProducts({ search, categoryId, page, limit }) {
  const where = {
    isActive: true,
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            ...searchFilter(search, ['name', 'description']).OR,
            { variants: { some: { OR: [{ sku: { contains: search } }, { barcode: { contains: search } }] } } },
          ],
        }
      : {}),
  };

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      ...getPagination({ page, limit }),
      include: productInclude,
    }),
  ]);

  return { data: products.map(serializeProduct), pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw ApiError.notFound('Product not found');
  return serializeProduct(product);
}
async function getProductRaw(id) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

async function updateProduct(id, updates) {
  await getProductRaw(id); 
  if (updates.categoryId) {
    await categoryService.getCategoryById(updates.categoryId);
  }
  await prisma.product.update({ where: { id }, data: updates });
  return getProductById(id);
}

async function deactivateProduct(id) {
  const product = await getProductRaw(id);
  if (!product.isActive) {
    throw ApiError.conflict('Product is already inactive');
  }
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

async function reactivateProduct(id) {
  const product = await getProductRaw(id);
  if (product.isActive) {
    throw ApiError.conflict('Product is already active');
  }
  return prisma.product.update({ where: { id }, data: { isActive: true } });
}

async function attachModifierGroup(productId, modifierGroupId) {
  await getProductRaw(productId);
  await modifierGroupService.getModifierGroupById(modifierGroupId); 

  const existing = await prisma.productModifierGroup.findUnique({
    where: { productId_modifierGroupId: { productId, modifierGroupId } },
  });
  if (existing) {
    throw ApiError.conflict('This modifier group is already attached to this product');
  }

  await prisma.$transaction([
    prisma.productModifierGroup.create({ data: { productId, modifierGroupId } }),
    prisma.product.update({ where: { id: productId }, data: { updatedAt: new Date() } }),
  ]);
  return getProductById(productId);
}

async function detachModifierGroup(productId, modifierGroupId) {
  await getProductRaw(productId);
  await prisma.$transaction([
    prisma.productModifierGroup.deleteMany({ where: { productId, modifierGroupId } }),
    prisma.product.update({ where: { id: productId }, data: { updatedAt: new Date() } }),
  ]);
  return getProductById(productId);
}

export default {
  createProduct,
  listProducts,
  getProductById,
  getProductRaw,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
  attachModifierGroup,
  detachModifierGroup,
  provisionInventory,
};
