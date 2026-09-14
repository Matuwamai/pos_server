import express from 'express';
import employeeShiftController from '../controllers/employeeShift.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import validate from '../middlewares/validate.js';
import employeeShiftValidation from '../validations/employeeShift.js';

const router = express.Router();

router.use(authenticate);

// readOwn gates entry to these list/detail routes; the service further
// restricts to "own only" unless the caller also holds readAll.
router.get('/active', requirePermission('employeeShifts.readOwn'), employeeShiftController.getActive);
router.get('/', requirePermission('employeeShifts.readOwn'), validate(employeeShiftValidation.list), employeeShiftController.list);
router.get('/:id', requirePermission('employeeShifts.readOwn'), validate(employeeShiftValidation.getById), employeeShiftController.getById);
router.post('/clock-in', requirePermission('employeeShifts.clockIn'), validate(employeeShiftValidation.clockIn), employeeShiftController.clockIn);
router.post('/:id/clock-out', requirePermission('employeeShifts.clockOut'), validate(employeeShiftValidation.clockOut), employeeShiftController.clockOut);

export default router;
