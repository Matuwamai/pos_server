import express from 'express';
import employeeShiftController from '../controllers/employeeShift.js';
import authenticate from '../middlewares/authenticate.js';
import validate from '../middlewares/validate.js';
import employeeShiftValidation from '../validations/employeeShift.js';

const router = express.Router();

router.use(authenticate);

// No role restriction — clocking in/out is a normal self-service action for
// any role. Visibility of OTHER people's shifts is restricted inside the
// service instead (OWNER/MANAGER only), not at the route level.
router.get('/active', employeeShiftController.getActive);
router.get('/', validate(employeeShiftValidation.list), employeeShiftController.list);
router.get('/:id', validate(employeeShiftValidation.getById), employeeShiftController.getById);
router.post('/clock-in', validate(employeeShiftValidation.clockIn), employeeShiftController.clockIn);
router.post('/:id/clock-out', validate(employeeShiftValidation.clockOut), employeeShiftController.clockOut);

export default router;
