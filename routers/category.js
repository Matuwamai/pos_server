import express from 'express';
import categoryController from '../controllers/category.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import categoryValidation from '../validations/category.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('categories.list'), validate(categoryValidation.list), categoryController.list);
router.get('/:id', requirePermission('categories.read'), validate(categoryValidation.getById), categoryController.getById);

router.post('/', requirePermission('categories.create'), validate(categoryValidation.create), categoryController.create);
router.patch('/:id', requirePermission('categories.update'), validate(categoryValidation.update), categoryController.update);
router.post('/:id/deactivate', requirePermission('categories.deactivate'), validate(categoryValidation.deactivate), categoryController.deactivate);
router.post('/:id/reactivate', requirePermission('categories.reactivate'), validate(categoryValidation.reactivate), categoryController.reactivate);

export default router;
