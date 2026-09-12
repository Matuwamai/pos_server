import express from 'express';
import categoryController from '../controllers/category.js';
import authenticate from '../middlewares/authenticate.js';
import requireRole from '../middlewares/requireRole.js';
import validate from '../middlewares/validate.js';
import categoryValidation from '../validations/category.js';

const router = express.Router();

router.use(authenticate);

router.get('/', validate(categoryValidation.list), categoryController.list);
router.get('/:id', validate(categoryValidation.getById), categoryController.getById);

router.post('/', requireRole('OWNER', 'MANAGER'), validate(categoryValidation.create), categoryController.create);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(categoryValidation.update), categoryController.update);
router.post('/:id/deactivate', requireRole('OWNER', 'MANAGER'), validate(categoryValidation.deactivate), categoryController.deactivate);
router.post('/:id/reactivate', requireRole('OWNER', 'MANAGER'), validate(categoryValidation.reactivate), categoryController.reactivate);

export default router;
