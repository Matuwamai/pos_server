import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import categoryService from './category.js';
import productService from './product.js';

// One row per variant, matching the "products + variants only" scope: a
// product with several variants (e.g. sizes) appears as several rows
// sharing the same `name`. An exported file re-imports cleanly: existing
// rows are matched by sku and updated in place rather than duplicated.
const CSV_COLUMNS = [
  'category',
  'name',
  'description',
  'isComposite',
  'trackInventory',
  'sku',
  'barcode',
  'attributes',
  'price',
  'cost',
];

const emptyToUndefined = (val) => (val === '' || val === undefined || val === null ? undefined : val);

const rowSchema = z.object({
  category: z.preprocess(emptyToUndefined, z.string().min(1).max(120).optional()),
  name: z.string().min(1, 'name is required').max(160),
  description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  isComposite: z.preprocess(emptyToUndefined, z.string().optional()).transform((v) => v === 'true'),
  trackInventory: z
    .preprocess(emptyToUndefined, z.string().optional())
    .transform((v) => (v === undefined ? true : v === 'true')),
  sku: z.string().min(1, 'sku is required').max(64),
  barcode: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  attributes: z.preprocess(emptyToUndefined, z.string().optional()), // raw JSON text, parsed below
  price: z.preprocess(emptyToUndefined, z.coerce.number({ invalid_type_error: 'price must be a number' }).nonnegative()),
  cost: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
});

// Processes rows sequentially (not Promise.all) so failures stay isolated
// to their own row, product-lookup caching stays correct within the batch,
// and the database isn't hit with hundreds of concurrent writes from one
// file. A bad row never aborts the rest of the import.
async function importProductsFromCsv(buffer) {
  let records;
  try {
    records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    throw ApiError.badRequest('Could not parse CSV file', { message: err.message });
  }

  const result = { totalRows: records.length, created: 0, updated: 0, failed: 0, errors: [] };
  const productIdByName = new Map(); // scoped to this import batch only

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2; // +1 for the header row, +1 to make it 1-indexed
    try {
      const row = rowSchema.parse(records[i]);

      let attributes;
      if (row.attributes) {
        try {
          attributes = JSON.parse(row.attributes);
        } catch {
          throw new Error(`attributes column is not valid JSON: "${row.attributes}"`);
        }
      }

      let productId = productIdByName.get(row.name);
      if (!productId) {
        const categoryId = row.category ? (await categoryService.findOrCreateByName(row.category)).id : undefined;
        const existingProduct = await prisma.product.findFirst({ where: { name: row.name } });
        productId = existingProduct
          ? existingProduct.id
          : (
              await prisma.product.create({
                data: {
                  name: row.name,
                  description: row.description,
                  categoryId,
                  isComposite: row.isComposite,
                  trackInventory: row.trackInventory,
                },
              })
            ).id;
        productIdByName.set(row.name, productId);
      }

      const existingVariant = await prisma.productVariant.findFirst({ where: { sku: row.sku } });
      const variantData = { barcode: row.barcode, attributes, price: row.price, cost: row.cost };

      if (existingVariant) {
        await prisma.productVariant.update({ where: { id: existingVariant.id }, data: variantData });
        result.updated++;
      } else {
        const product = await productService.getProductRaw(productId);
        await prisma.$transaction(async (tx) => {
          const variant = await tx.productVariant.create({ data: { productId, sku: row.sku, ...variantData } });
          await productService.provisionInventory(tx, [variant.id], product.trackInventory);
        });
        result.created++;
      }
    } catch (err) {
      result.failed++;
      const message =
        err instanceof z.ZodError
          ? err.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
          : err.message;
      result.errors.push({ row: rowNumber, message });
    }
  }

  return result;
}

// Runs inside the request's tenant context (via the caller being behind
// authenticate()), so this only ever reads the caller's own products —
// deliberately unpaginated, since "give me everything" is the point of export.
async function exportProductsToCsv() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: { select: { name: true } }, variants: true },
    orderBy: { name: 'asc' },
  });

  const rows = products.flatMap((product) =>
    product.variants.map((variant) => ({
      category: product.category?.name ?? '',
      name: product.name,
      description: product.description ?? '',
      isComposite: String(product.isComposite),
      trackInventory: String(product.trackInventory),
      sku: variant.sku,
      barcode: variant.barcode ?? '',
      attributes: variant.attributes ? JSON.stringify(variant.attributes) : '',
      price: variant.price.toString(),
      cost: variant.cost ? variant.cost.toString() : '',
    }))
  );

  return stringify(rows, { header: true, columns: CSV_COLUMNS });
}

export default { importProductsFromCsv, exportProductsToCsv };
