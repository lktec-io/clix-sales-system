import { Router } from 'express';
import * as medicineController from '../controllers/medicine.controller.js';
import * as medicineImportController from '../controllers/medicineImport.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { createSpreadsheetUploader } from '../middlewares/upload.js';
import { medicineValidator, medicineImportCommitValidator } from '../validators/medicine.validator.js';

const router = Router();
const spreadsheetUploader = createSpreadsheetUploader();

router.use(authenticate);

// Deliberately ungated by requireModule — Pharmacy Sales' medicine picker
// depends on this lookup, same reasoning customer.routes.js/active and
// supplier.routes.js/active are exempt for their own dependent modules.
router.get('/active', medicineController.listActive);

router.use(requireModule('medicines'));

router.get('/dashboard-summary', authorize('medicines.view'), medicineController.dashboardSummary);
router.get('/expiring', authorize('medicines.view'), medicineController.listExpiring);
router.get('/import/template', authorize('medicines.manage'), medicineImportController.downloadImportTemplate);
router.post('/import/preview', authorize('medicines.manage'), spreadsheetUploader.single('file'), medicineImportController.previewImport);
router.post(
  '/import/commit',
  authorize('medicines.manage'),
  requireActiveTrial,
  medicineImportCommitValidator,
  validateRequest,
  medicineImportController.commitImport,
);
router.get('/', authorize('medicines.view'), medicineController.list);
router.get('/:id', authorize('medicines.view'), medicineController.getById);
router.post('/', authorize('medicines.manage'), requireActiveTrial, medicineValidator, validateRequest, medicineController.create);
router.put('/:id', authorize('medicines.manage'), requireActiveTrial, medicineValidator, validateRequest, medicineController.update);
router.delete('/:id', authorize('medicines.manage'), requireActiveTrial, medicineController.remove);

export default router;
