import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireModule } from '../middlewares/requireModule.js';

const router = Router();

router.use(authenticate, authorize('reports.view'), requireModule('reports'));

router.get('/:type/export/pdf', authorize('reports.export'), reportController.exportPdf);
router.get('/:type/export/excel', authorize('reports.export'), reportController.exportExcel);
router.get('/:type/export/csv', authorize('reports.export'), reportController.exportCsv);
router.get('/:type', reportController.getReport);

export default router;
