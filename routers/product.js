import express from 'express';
import productController from '../controllers/product.js';
import productVariantController from '../controllers/productVariant.js';
import productImportExportController from '../controllers/productImportExport.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import upload from '../middlewares/upload.js';
import productValidation from '../validations/product.js';
import productVariantValidation from '../validations/productVariant.js';

const router = express.Router();

router.use(authenticate);

// CSV import/export — declared before the /:id routes below, though route
// order doesn't actually matter here since these are two path segments
// (/export/csv) and /:id only ever matches one.
router.get('/export/csv', productImportExportController.exportCsv);
router.post(
  '/import/csv',
  requireRole('OWNER', 'MANAGER'),
  upload.single('file'),
  productImportExportController.importCsv
);

router.get('/', validate(productValidation.list), productController.list);
router.get('/:id', validate(productValidation.getById), productController.getById);
router.post('/', requireRole('OWNER', 'MANAGER'), validate(productValidation.create), productController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(productValidation.update), productController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(productValidation.deactivate), productController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(productValidation.reactivate), productController.reactivate);

router.post(
  '/:id/modifier-groups',
  requireRole('OWNER', 'MANAGER'),
  validate(productValidation.attachModifierGroup),
  productController.attachModifierGroup
);
router.delete(
  '/:id/modifier-groups/:modifierGroupId',
  requireRole('OWNER', 'MANAGER'),
  validate(productValidation.detachModifierGroup),
  productController.detachModifierGroup
);

// Nested: /api/v1/products/:productId/variants
router.post(
  '/:productId/variants',
  requireRole('OWNER', 'MANAGER'),
  validate(productVariantValidation.addVariant),
  productVariantController.addVariant
);
router.get('/:productId/variants/:variantId', validate(productVariantValidation.getById), productVariantController.getById);
router.patch(
  '/:productId/variants/:variantId',
  requireRole('OWNER', 'MANAGER'),
  validate(productVariantValidation.update),
  productVariantController.update
);
router.post(
  '/:productId/variants/:variantId/deactivate',
  requireRole('OWNER', 'MANAGER'),
  validate(productVariantValidation.deactivate),
  productVariantController.deactivate
);
router.post(
  '/:productId/variants/:variantId/reactivate',
  requireRole('OWNER', 'MANAGER'),
  validate(productVariantValidation.reactivate),
  productVariantController.reactivate
);

// Nested: bill-of-materials for a composite variant
router.get(
  '/:productId/variants/:variantId/components',
  validate(productVariantValidation.listComponents),
  productVariantController.listComponents
);
router.post(
  '/:productId/variants/:variantId/components',
  requireRole('OWNER', 'MANAGER'),
  validate(productVariantValidation.addComponent),
  productVariantController.addComponent
);
router.delete(
  '/:productId/variants/:variantId/components/:componentId',
  requireRole('OWNER', 'MANAGER'),
  validate(productVariantValidation.removeComponent),
  productVariantController.removeComponent
);

export default router;
