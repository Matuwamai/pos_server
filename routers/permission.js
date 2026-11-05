import express from 'express';
import permissionController from '../controllers/permission.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requirePermission('permissions.list'), permissionController.list);

export default router;
