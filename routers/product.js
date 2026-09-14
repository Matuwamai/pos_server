import express from 'express';
import productController from '../controllers/product.js';
import productVariantController from '../controllers/productVariant.js';
import productImportExportController from '../controllers/productImportExport.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import upload from '../middlewares/upload.js';
import productValidation from '../validations/product.js';
import productVariantValidation from '../validations/productVariant.js';

const router = express.Router();

router.use(authenticate);

// CSV import/export — declared before the /:id routes below, though route
// order doesn't actually matter here since these are two path segments
// (/export/csv) and /:id only ever matches one.
router.get('/export/csv', requirePermission('products.export'), productImportExportController.exportCsv);
router.post(
  '/import/csv',
  requirePermission('products.import'),
  upload.single('file'),
  productImportExportController.importCsv
);

router.get('/', requirePermission('products.list'), validate(productValidation.list), productController.list);
router.get('/:id', requirePermission('products.read'), validate(productValidation.getById), productController.getById);
router.post('/', requirePermission('products.create'), validate(productValidation.create), productController.create);
router.patch('/:id', requirePermission('products.update'), validate(productValidation.update), productController.update);
router.post('/:id/deactivate', requirePermission('products.deactivate'), validate(productValidation.deactivate), productController.deactivate);
router.post('/:id/reactivate', requirePermission('products.reactivate'), validate(productValidation.reactivate), productController.reactivate);

router.post(
  '/:id/modifier-groups',
  requirePermission('products.modifierGroups.attach'),
  validate(productValidation.attachModifierGroup),
  productController.attachModifierGroup
);
router.delete(
  '/:id/modifier-groups/:modifierGroupId',
  requirePermission('products.modifierGroups.detach'),
  validate(productValidation.detachModifierGroup),
  productController.detachModifierGroup
);

// Nested: /api/v1/products/:productId/variants
router.post(
  '/:productId/variants',
  requirePermission('variants.create'),
  validate(productVariantValidation.addVariant),
  productVariantController.addVariant
);
router.get(
  '/:productId/variants/:variantId',
  requirePermission('variants.read'),
  validate(productVariantValidation.getById),
  productVariantController.getById
);
router.patch(
  '/:productId/variants/:variantId',
  requirePermission('variants.update'),
  validate(productVariantValidation.update),
  productVariantController.update
);
router.post(
  '/:productId/variants/:variantId/deactivate',
  requirePermission('variants.deactivate'),
  validate(productVariantValidation.deactivate),
  productVariantController.deactivate
);
router.post(
  '/:productId/variants/:variantId/reactivate',
  requirePermission('variants.reactivate'),
  validate(productVariantValidation.reactivate),
  productVariantController.reactivate
);

// Nested: bill-of-materials for a composite variant
router.get(
  '/:productId/variants/:variantId/components',
  requirePermission('variants.components.list'),
  validate(productVariantValidation.listComponents),
  productVariantController.listComponents
);
router.post(
  '/:productId/variants/:variantId/components',
  requirePermission('variants.components.create'),
  validate(productVariantValidation.addComponent),
  productVariantController.addComponent
);
router.delete(
  '/:productId/variants/:variantId/components/:componentId',
  requirePermission('variants.components.delete'),
  validate(productVariantValidation.removeComponent),
  productVariantController.removeComponent
);

export default router;
