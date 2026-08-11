import { Router } from 'express';
import * as repairController from '../controllers/repair.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  repairIntakeValidator, repairDiagnosisValidator, repairTechnicianValidator,
  repairPartValidator, repairPaymentValidator, repairNotesValidator,
} from '../validators/repair.validator.js';

const router = Router();

router.use(authenticate, requireModule('repairs'));

router.get('/summary', authorize('repairs.view'), repairController.summary);
router.get('/recent', authorize('repairs.view'), repairController.recent);
router.get('/', authorize('repairs.view'), repairController.list);
router.get('/:id', authorize('repairs.view'), repairController.getById);

router.post('/', authorize('repairs.create'), requireActiveTrial, repairIntakeValidator, validateRequest, repairController.create);

router.put('/:id/diagnosis', authorize('repairs.manage'), requireActiveTrial, repairDiagnosisValidator, validateRequest, repairController.updateDiagnosis);
router.patch('/:id/technician', authorize('repairs.manage'), requireActiveTrial, repairTechnicianValidator, validateRequest, repairController.assignTechnician);
router.post('/:id/start-diagnosis', authorize('repairs.manage'), requireActiveTrial, repairController.startDiagnosis);
router.post('/:id/send-for-approval', authorize('repairs.manage'), requireActiveTrial, repairController.sendForApproval);
router.post('/:id/unrepairable', authorize('repairs.manage'), requireActiveTrial, repairNotesValidator, validateRequest, repairController.markUnrepairable);
router.post('/:id/approve', authorize('repairs.manage'), requireActiveTrial, repairController.approve);
router.post('/:id/reject', authorize('repairs.manage'), requireActiveTrial, repairNotesValidator, validateRequest, repairController.reject);
router.post('/:id/start-repair', authorize('repairs.manage'), requireActiveTrial, repairController.startRepair);
router.post('/:id/parts', authorize('repairs.manage'), requireActiveTrial, repairPartValidator, validateRequest, repairController.addPart);
router.post('/:id/ready', authorize('repairs.manage'), requireActiveTrial, repairController.markReady);
router.post('/:id/payments', authorize('repairs.manage'), requireActiveTrial, repairPaymentValidator, validateRequest, repairController.recordPayment);
router.post('/:id/complete', authorize('repairs.manage'), requireActiveTrial, repairController.completeCollection);
router.post('/:id/cancel', authorize('repairs.manage'), requireActiveTrial, repairNotesValidator, validateRequest, repairController.cancel);

export default router;
